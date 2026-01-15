import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { UserRole } from '@/lib/db/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, role, dso_id, invited_by, inviter_name } = body;

        // Validate input
        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        if (!dso_id) {
            return NextResponse.json(
                { error: 'DSO ID is required' },
                { status: 400 }
            );
        }

        if (!invited_by) {
            return NextResponse.json(
                { error: 'Inviter user ID is required' },
                { status: 400 }
            );
        }

        // Validate role
        const validRoles: UserRole[] = ['admin', 'manager', 'viewer'];
        if (!role || !validRoles.includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be admin, manager, or viewer' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Normalize email to lowercase
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user is already a member
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
            u => u.email?.toLowerCase() === normalizedEmail
        );

        if (existingUser) {
            // Check if they already have access to this DSO
            const { data: existingAccess } = await supabaseAdmin
                .from('user_dso_access')
                .select('id')
                .eq('user_id', existingUser.id)
                .eq('dso_id', dso_id)
                .single();

            if (existingAccess) {
                return NextResponse.json(
                    { error: 'This user is already a member of this workspace' },
                    { status: 400 }
                );
            }

            // User exists but doesn't have access - add them directly
            const { error: accessError } = await supabaseAdmin
                .from('user_dso_access')
                .insert({
                    user_id: existingUser.id,
                    dso_id: dso_id,
                    role: role,
                });

            if (accessError) {
                console.error('Error adding user access:', accessError);
                return NextResponse.json(
                    { error: 'Failed to add user to workspace' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: `${normalizedEmail} has been added to the workspace`,
                added_directly: true,
            });
        }

        // Check for existing pending invite
        const { data: existingInvite } = await supabaseAdmin
            .from('team_invites')
            .select('id, expires_at')
            .eq('email', normalizedEmail)
            .eq('dso_id', dso_id)
            .eq('status', 'pending')
            .single();

        if (existingInvite) {
            return NextResponse.json(
                { error: 'An invite has already been sent to this email' },
                { status: 400 }
            );
        }

        // Store the invite in our database first
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('team_invites')
            .insert({
                email: normalizedEmail,
                dso_id: dso_id,
                role: role,
                invited_by: invited_by,
                expires_at: expiresAt.toISOString(),
            })
            .select()
            .single();

        if (inviteError) {
            console.error('Error creating invite record:', inviteError);
            return NextResponse.json(
                { error: 'Failed to create invite' },
                { status: 500 }
            );
        }

        // Send the invite email via Supabase Auth
        // This will send a magic link email to the user
        const { data: authInvite, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            normalizedEmail,
            {
                data: {
                    role: role,
                    dso_id: dso_id,
                    invite_id: invite.id,
                    inviter_name: inviter_name || 'Your teammate',
                },
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?invited=true`,
            }
        );

        if (authError) {
            console.error('Error sending invite email:', authError);

            // Clean up the invite record if email fails
            await supabaseAdmin
                .from('team_invites')
                .delete()
                .eq('id', invite.id);

            // Check if it's a rate limit or email configuration issue
            if (authError.message.includes('rate limit')) {
                return NextResponse.json(
                    { error: 'Too many invites sent. Please wait before sending more.' },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                { error: 'Failed to send invite email. Please check email configuration.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Invitation sent to ${normalizedEmail}`,
            invite: {
                id: invite.id,
                email: normalizedEmail,
                role: role,
                expires_at: expiresAt.toISOString(),
            }
        });
    } catch (error) {
        console.error('Error sending invite:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint to list pending invites for a DSO
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dsoId = searchParams.get('dso_id');

        if (!dsoId) {
            return NextResponse.json(
                { error: 'dso_id is required' },
                { status: 400 }
            );
        }

        const { data: invites, error } = await supabaseAdmin
            .from('team_invites')
            .select('*')
            .eq('dso_id', dsoId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching invites:', error);
            return NextResponse.json(
                { error: 'Failed to fetch invites' },
                { status: 500 }
            );
        }

        return NextResponse.json({ invites: invites || [] });
    } catch (error) {
        console.error('Error in invites GET:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE endpoint to cancel an invite
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const inviteId = searchParams.get('id');

        if (!inviteId) {
            return NextResponse.json(
                { error: 'Invite ID is required' },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from('team_invites')
            .update({ status: 'cancelled' })
            .eq('id', inviteId);

        if (error) {
            console.error('Error cancelling invite:', error);
            return NextResponse.json(
                { error: 'Failed to cancel invite' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in invite DELETE:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
