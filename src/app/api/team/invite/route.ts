import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { UserRole } from '@/lib/db/types';
import { requireAuth, requireAuthWithFallback, checkDsoAccess, getUserOrg } from '@/lib/auth';

interface ExistingInvitee {
    id: string;
    email: string;
}

function normalizeDsoIds(dsoIds: unknown, dsoId: unknown): string[] {
    if (Array.isArray(dsoIds)) {
        return [...new Set(
            dsoIds
                .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                .map((value) => value.trim())
        )];
    }

    if (typeof dsoId === 'string' && dsoId.trim().length > 0) {
        return [dsoId.trim()];
    }

    return [];
}

async function ensureOrgMembership(userId: string, orgId: string) {
    const { data: existingOrgMember, error: existingOrgMemberError } = await supabaseAdmin
        .from('org_members')
        .select('id')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existingOrgMemberError) {
        throw existingOrgMemberError;
    }

    if (existingOrgMember) {
        return;
    }

    const { error: orgMemberError } = await supabaseAdmin
        .from('org_members')
        .insert({ org_id: orgId, user_id: userId, role: 'member' });

    if (orgMemberError && orgMemberError.code !== '23505') {
        throw orgMemberError;
    }
}

async function findExistingInviteeByEmail(normalizedEmail: string): Promise<ExistingInvitee | null> {
    const { data: existingProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

    if (profileError) {
        throw profileError;
    }

    if (existingProfile) {
        return existingProfile;
    }

    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
    });

    if (authUsersError) {
        throw authUsersError;
    }

    const existingAuthUser = authUsers.users.find(
        (user) => user.email?.toLowerCase() === normalizedEmail
    );

    if (!existingAuthUser?.email) {
        return null;
    }

    const { error: profileInsertError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
            id: existingAuthUser.id,
            email: existingAuthUser.email.toLowerCase(),
            name: existingAuthUser.user_metadata?.name
                || existingAuthUser.user_metadata?.full_name
                || null,
        });

    if (profileInsertError) {
        throw profileInsertError;
    }

    return {
        id: existingAuthUser.id,
        email: existingAuthUser.email.toLowerCase(),
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, role, dso_id, dso_ids, inviter_name, invited_by } = body;
        const normalizedDsoIds = normalizeDsoIds(dso_ids, dso_id);

        // Try session auth first, fall back to invited_by from body
        const authResult = await requireAuth(request);
        let currentUser: { id: string; email: string };
        if (authResult.response) {
            // Session auth failed - use invited_by as fallback
            if (!invited_by) {
                return authResult.response;
            }
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(invited_by);
            if (!userData?.user) {
                return authResult.response;
            }
            currentUser = { id: userData.user.id, email: userData.user.email || '' };
        } else {
            currentUser = authResult.user;
        }

        // Verify caller is an org member (org boundary check)
        const orgInfo = await getUserOrg(currentUser.id);
        if (!orgInfo) {
            return NextResponse.json(
                { error: 'Not a member of any organization' },
                { status: 403 }
            );
        }

        // Validate input
        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        if (normalizedDsoIds.length === 0) {
            return NextResponse.json(
                { error: 'At least one workspace is required' },
                { status: 400 }
            );
        }

        // Verify current user has admin access to every requested DSO
        const accessChecks = await Promise.all(
            normalizedDsoIds.map((requestedDsoId) => checkDsoAccess(currentUser.id, requestedDsoId))
        );
        const canAccessAllDsos = accessChecks.every(
            ({ hasAccess, role: callerRole }) => hasAccess && callerRole === 'admin'
        );

        if (!canAccessAllDsos) {
            return NextResponse.json(
                { error: 'Admin access required for all selected workspaces' },
                { status: 403 }
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

        // Prevent self-invite
        if (normalizedEmail === currentUser.email.toLowerCase()) {
            return NextResponse.json(
                { error: 'You cannot invite yourself' },
                { status: 400 }
            );
        }

        // Check if user already exists. Legacy users may exist in auth.users without user_profiles.
        const existingProfile = await findExistingInviteeByEmail(normalizedEmail);

        if (existingProfile) {
            try {
                await ensureOrgMembership(existingProfile.id, orgInfo.orgId);
            } catch (orgMemberError) {
                console.error('Error adding user org membership:', orgMemberError);
                return NextResponse.json(
                    { error: 'Failed to add user to organization' },
                    { status: 500 }
                );
            }

            const { data: existingAccessRows, error: existingAccessError } = await supabaseAdmin
                .from('user_dso_access')
                .select('dso_id')
                .eq('user_id', existingProfile.id)
                .in('dso_id', normalizedDsoIds);

            if (existingAccessError) {
                console.error('Error fetching existing user access:', existingAccessError);
                return NextResponse.json(
                    { error: 'Failed to check existing workspace access' },
                    { status: 500 }
                );
            }

            const existingAccessSet = new Set((existingAccessRows || []).map((row) => row.dso_id));
            const dsoIdsToAdd = normalizedDsoIds.filter((requestedDsoId) => !existingAccessSet.has(requestedDsoId));

            if (dsoIdsToAdd.length === 0) {
                await supabaseAdmin
                    .from('team_invites')
                    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                    .eq('email', normalizedEmail)
                    .eq('status', 'pending')
                    .in('dso_id', normalizedDsoIds);

                return NextResponse.json(
                    { error: 'User already has access to all selected workspaces' },
                    { status: 400 }
                );
            }

            const { error: accessError } = await supabaseAdmin
                .from('user_dso_access')
                .insert(
                    dsoIdsToAdd.map((requestedDsoId) => ({
                        user_id: existingProfile.id,
                        dso_id: requestedDsoId,
                        role,
                    }))
                );

            if (accessError) {
                console.error('Error adding user access:', accessError);
                return NextResponse.json(
                    { error: 'Failed to add user to selected workspaces' },
                    { status: 500 }
                );
            }

            // Mark any pending invites as accepted
            await supabaseAdmin
                .from('team_invites')
                .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                .eq('email', normalizedEmail)
                .eq('status', 'pending')
                .in('dso_id', normalizedDsoIds);

            return NextResponse.json({
                success: true,
                message: `${normalizedEmail} has been added to ${dsoIdsToAdd.length} workspace${dsoIdsToAdd.length === 1 ? '' : 's'}`,
                added_directly: true,
                added_count: dsoIdsToAdd.length,
            });
        }

        const { data: existingPendingInvites, error: existingPendingInvitesError } = await supabaseAdmin
            .from('team_invites')
            .select('id, dso_id')
            .eq('email', normalizedEmail)
            .eq('status', 'pending')
            .in('dso_id', normalizedDsoIds);

        if (existingPendingInvitesError) {
            console.error('Error checking existing invites:', existingPendingInvitesError);
            return NextResponse.json(
                { error: 'Failed to check existing invites' },
                { status: 500 }
            );
        }

        const pendingDsoIds = new Set((existingPendingInvites || []).map((invite) => invite.dso_id));
        const dsoIdsToInvite = normalizedDsoIds.filter((requestedDsoId) => !pendingDsoIds.has(requestedDsoId));

        if (dsoIdsToInvite.length === 0) {
            return NextResponse.json(
                { error: 'Invites already sent for all selected workspaces' },
                { status: 400 }
            );
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const { data: invites, error: inviteError } = await supabaseAdmin
            .from('team_invites')
            .insert(
                dsoIdsToInvite.map((requestedDsoId) => ({
                    email: normalizedEmail,
                    dso_id: requestedDsoId,
                    role,
                    invited_by: currentUser.id,
                    expires_at: expiresAt.toISOString(),
                }))
            )
            .select()
            ;

        if (inviteError) {
            console.error('Error creating invite record:', inviteError);
            return NextResponse.json(
                { error: 'Failed to create invite' },
                { status: 500 }
            );
        }

        const inviteIds = (invites || []).map((invite) => invite.id);

        const { error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            normalizedEmail,
            {
                data: {
                    role,
                    dso_ids: normalizedDsoIds,
                    invite_ids: inviteIds,
                    inviter_name: inviter_name || 'Your teammate',
                },
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?invited=true`,
            }
        );

        if (authError) {
            console.error('Error sending invite email:', authError);

            // Clean up the invite records if email fails
            await supabaseAdmin
                .from('team_invites')
                .delete()
                .in('id', inviteIds);

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
            message: `Invitation sent to ${normalizedEmail} for ${dsoIdsToInvite.length} workspace${dsoIdsToInvite.length === 1 ? '' : 's'}`,
            invite_count: dsoIdsToInvite.length,
            skipped_count: pendingDsoIds.size,
            invites: (invites || []).map((invite) => ({
                id: invite.id,
                email: normalizedEmail,
                dso_id: invite.dso_id,
                role,
                expires_at: expiresAt.toISOString(),
            })),
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
        // Require authentication (with user_id param fallback)
        const authResult = await requireAuthWithFallback(request);
        if ('response' in authResult) {
            return authResult.response;
        }
        const userId = authResult.userId;

        // Verify caller is an org member (org boundary check)
        const orgInfo = await getUserOrg(userId);
        if (!orgInfo) {
            return NextResponse.json(
                { error: 'Not a member of any organization' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const dsoId = searchParams.get('dso_id');

        if (!dsoId) {
            return NextResponse.json(
                { error: 'dso_id is required' },
                { status: 400 }
            );
        }

        // Verify current user has admin access to view invites
        const { hasAccess, role: callerRole } = await checkDsoAccess(userId, dsoId);
        if (!hasAccess || callerRole !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required to view pending invites' },
                { status: 403 }
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

        if (!invites || invites.length === 0) {
            return NextResponse.json({ invites: [] });
        }

        // Filter out invites for users who are already members
        // Get all current members of this DSO
        const { data: members } = await supabaseAdmin
            .from('user_dso_access')
            .select('user_id')
            .eq('dso_id', dsoId);

        if (members && members.length > 0) {
            // Get emails of current members
            const memberEmails = new Set<string>();
            for (const member of members) {
                try {
                    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
                    if (userData?.user?.email) {
                        memberEmails.add(userData.user.email.toLowerCase());
                    }
                } catch {
                    // Skip if can't get user
                }
            }

            // Filter out invites for users who are already members
            const filteredInvites = invites.filter(invite => !memberEmails.has(invite.email.toLowerCase()));

            // Clean up any stale invites (mark as accepted)
            const staleInviteIds = invites
                .filter(invite => memberEmails.has(invite.email.toLowerCase()))
                .map(invite => invite.id);

            if (staleInviteIds.length > 0) {
                await supabaseAdmin
                    .from('team_invites')
                    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                    .in('id', staleInviteIds);
            }

            return NextResponse.json({ invites: filteredInvites });
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
        // Require authentication (with user_id param fallback)
        const authResult = await requireAuthWithFallback(request);
        if ('response' in authResult) {
            return authResult.response;
        }
        const userId = authResult.userId;

        // Verify caller is an org member (org boundary check)
        const orgInfo = await getUserOrg(userId);
        if (!orgInfo) {
            return NextResponse.json(
                { error: 'Not a member of any organization' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const inviteId = searchParams.get('id');

        if (!inviteId) {
            return NextResponse.json(
                { error: 'Invite ID is required' },
                { status: 400 }
            );
        }

        // Get the invite to check DSO access
        const { data: invite, error: fetchError } = await supabaseAdmin
            .from('team_invites')
            .select('dso_id')
            .eq('id', inviteId)
            .single();

        if (fetchError || !invite) {
            return NextResponse.json(
                { error: 'Invite not found' },
                { status: 404 }
            );
        }

        // Verify current user has admin access to cancel invites
        const { hasAccess, role: callerRole } = await checkDsoAccess(userId, invite.dso_id);
        if (!hasAccess || callerRole !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required to cancel invites' },
                { status: 403 }
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
