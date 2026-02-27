import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgAccess } from '@/lib/auth';
import { isValidOrgRole } from '@/lib/org-utils';

/**
 * POST /api/orgs/[id]/invites
 * Send an org-scoped invite by email.
 * - Existing users (found in user_profiles): added directly to org_members (no email)
 * - New users: inserted into org_invites + inviteUserByEmail
 * Only owners and admins can invite.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authResult = await requireOrgAccess(request, id, true);
    if (authResult.response) {
        return authResult.response;
    }

    const { user } = authResult;

    let body: { email?: string; role?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }

    const { email, role: rawRole } = body;

    // Validate email
    if (!email) {
        return NextResponse.json(
            { error: 'email is required' },
            { status: 400 }
        );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return NextResponse.json(
            { error: 'Invalid email format' },
            { status: 400 }
        );
    }

    // Default role to 'member', validate if provided
    const role = rawRole ?? 'member';
    if (!isValidOrgRole(role)) {
        return NextResponse.json(
            { error: 'Invalid role. Must be one of: owner, admin, member' },
            { status: 400 }
        );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Prevent self-invite
    if (normalizedEmail === user.email.toLowerCase().trim()) {
        return NextResponse.json(
            { error: 'You cannot invite yourself' },
            { status: 400 }
        );
    }

    // Branch A: Check if user already exists in user_profiles
    const { data: existingProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .single();

    if (existingProfile) {
        // User exists — check if already an org member
        const { data: existingMember } = await supabaseAdmin
            .from('org_members')
            .select('id')
            .eq('org_id', id)
            .eq('user_id', existingProfile.id)
            .single();

        if (existingMember) {
            return NextResponse.json(
                { error: 'User is already a member of this organization' },
                { status: 409 }
            );
        }

        // Add directly to org_members (no email invite needed)
        const { error: memberError } = await supabaseAdmin
            .from('org_members')
            .insert({ org_id: id, user_id: existingProfile.id, role });

        if (memberError) {
            console.error('Failed to add existing user to org:', memberError);
            return NextResponse.json(
                { error: 'Failed to add member' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, added_directly: true });
    }

    // Branch B: New user — insert into org_invites and send invite email
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteError } = await supabaseAdmin
        .from('org_invites')
        .insert({
            org_id: id,
            email: normalizedEmail,
            role,
            invited_by: user.id,
            expires_at: expiresAt,
        })
        .select()
        .single();

    if (inviteError) {
        // 23505 = unique constraint (duplicate pending invite)
        if (inviteError.code === '23505') {
            return NextResponse.json(
                { error: 'A pending invite already exists for this email' },
                { status: 409 }
            );
        }
        console.error('Failed to create org invite:', inviteError);
        return NextResponse.json(
            { error: 'Failed to create invite' },
            { status: 500 }
        );
    }

    // Send invite email via Supabase Auth
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
            data: { org_id: id, invite_id: invite.id, role },
            redirectTo: `${appUrl}/auth/confirm`,
        }
    );

    if (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Rollback: delete the org_invites row
        await supabaseAdmin.from('org_invites').delete().eq('id', invite.id);
        return NextResponse.json(
            { error: 'Failed to send invite email' },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        invite: {
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expires_at: invite.expires_at,
        },
    });
}

/**
 * GET /api/orgs/[id]/invites
 * List all pending, non-expired invites for the organization.
 * Any org member can view the invite list.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authResult = await requireOrgAccess(request, id);
    if (authResult.response) {
        return authResult.response;
    }

    const { data: invites, error } = await supabaseAdmin
        .from('org_invites')
        .select('*')
        .eq('org_id', id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch org invites:', error);
        return NextResponse.json(
            { error: 'Failed to fetch invites' },
            { status: 500 }
        );
    }

    return NextResponse.json({ invites });
}
