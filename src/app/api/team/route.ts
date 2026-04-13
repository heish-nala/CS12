import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { UserRole } from '@/lib/db/types';
import { checkDsoAccess, getUserOrg, requireAuth } from '@/lib/auth';

interface TeamMember {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: UserRole;
    created_at: string;
    is_current_user?: boolean;
}

interface ExistingTeamUser {
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
    const { data: existingMembership, error: existingMembershipError } = await supabaseAdmin
        .from('org_members')
        .select('id')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existingMembershipError) {
        throw existingMembershipError;
    }

    if (existingMembership) {
        return;
    }

    const { error: insertMembershipError } = await supabaseAdmin
        .from('org_members')
        .insert({ org_id: orgId, user_id: userId, role: 'member' });

    if (insertMembershipError && insertMembershipError.code !== '23505') {
        throw insertMembershipError;
    }
}

async function findExistingUserByEmail(normalizedEmail: string): Promise<ExistingTeamUser | null> {
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

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Try to get user from session, fall back to user_id param
        const authResult = await requireAuth(request);
        let userId: string;
        if ('response' in authResult) {
            // Session auth failed, try user_id param as fallback
            const userIdParam = searchParams.get('user_id');
            if (!userIdParam) {
                return authResult.response;
            }
            userId = userIdParam;
        } else {
            userId = authResult.user.id;
        }

        // Get user's org (org membership is now the source of truth for team listing)
        const orgInfo = await getUserOrg(userId);
        if (!orgInfo) {
            return NextResponse.json({ members: [] });
        }

        // Query org members directly (replaces user_dso_access-based team listing)
        const { data: orgMembers, error: membersError } = await supabaseAdmin
            .from('org_members')
            .select('id, user_id, role, joined_at')
            .eq('org_id', orgInfo.orgId)
            .order('joined_at', { ascending: true });

        if (membersError) {
            console.error('Error fetching org members:', membersError);
            return NextResponse.json(
                { error: 'Failed to fetch team members' },
                { status: 500 }
            );
        }

        if (!orgMembers || orgMembers.length === 0) {
            return NextResponse.json({ members: [] });
        }

        // Batch-fetch user_profiles for all members (no FK join needed)
        const memberUserIds = orgMembers.map(m => m.user_id);
        const { data: profiles } = await supabaseAdmin
            .from('user_profiles')
            .select('id, email, name')
            .in('id', memberUserIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        const members: TeamMember[] = [];

        for (const member of orgMembers) {
            const uid = member.user_id;
            const profile = profileMap.get(uid);
            if (profile?.email) {
                const name = profile.name || profile.email.split('@')[0];
                members.push({
                    id: member.id,
                    user_id: uid,
                    email: profile.email,
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    role: member.role as UserRole,
                    created_at: member.joined_at,
                    is_current_user: uid === userId,
                });
            } else {
                // Fall back to auth admin API
                try {
                    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid);
                    if (userData?.user) {
                        const email = userData.user.email || uid;
                        const name = userData.user.user_metadata?.name ||
                                     userData.user.user_metadata?.full_name ||
                                     email.split('@')[0];
                        members.push({
                            id: member.id,
                            user_id: uid,
                            email: email,
                            name: name.charAt(0).toUpperCase() + name.slice(1),
                            role: member.role as UserRole,
                            created_at: member.joined_at,
                            is_current_user: uid === userId,
                        });
                    } else {
                        members.push({
                            id: member.id,
                            user_id: uid,
                            email: uid,
                            name: 'Unknown User',
                            role: member.role as UserRole,
                            created_at: member.joined_at,
                            is_current_user: uid === userId,
                        });
                    }
                } catch {
                    members.push({
                        id: member.id,
                        user_id: uid,
                        email: uid,
                        name: 'Unknown User',
                        role: member.role as UserRole,
                        created_at: member.joined_at,
                        is_current_user: uid === userId,
                    });
                }
            }
        }

        // Sort: current user first, then by name
        members.sort((a, b) => {
            if (a.is_current_user) return -1;
            if (b.is_current_user) return 1;
            return a.name.localeCompare(b.name);
        });

        // Get primaryDsoId for backward compatibility with invite flow
        // (still uses user_dso_access for the specific DSO context)
        const { data: userDsoAccess } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id')
            .eq('user_id', userId)
            .limit(1);
        const primaryDsoId = userDsoAccess && userDsoAccess.length > 0 ? userDsoAccess[0].dso_id : null;

        return NextResponse.json({ members, dso_id: primaryDsoId });
    } catch (error) {
        console.error('Error in team API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;
        }

        const { searchParams } = new URL(request.url);
        const body = await request.json();
        const { email, role, dso_id, dso_ids } = body;
        const normalizedDsoIds = normalizeDsoIds(dso_ids, dso_id ?? searchParams.get('dso_id'));

        if (!email || !role) {
            return NextResponse.json(
                { error: 'Email and role are required' },
                { status: 400 }
            );
        }

        const validRoles: UserRole[] = ['admin', 'manager', 'viewer'];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be admin, manager, or viewer' },
                { status: 400 }
            );
        }

        if (normalizedDsoIds.length === 0) {
            return NextResponse.json(
                { error: 'dso_id is required in the request body, dso_ids, or query string' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.toLowerCase().trim();
        const currentUser = authResult.user;
        const orgInfo = await getUserOrg(currentUser.id);

        if (!orgInfo) {
            return NextResponse.json(
                { error: 'Not a member of any organization' },
                { status: 403 }
            );
        }

        const { data: requestedDsos, error: requestedDsosError } = await supabaseAdmin
            .from('dsos')
            .select('id, org_id')
            .in('id', normalizedDsoIds);

        if (requestedDsosError) {
            console.error('Error fetching requested workspaces:', requestedDsosError);
            return NextResponse.json(
                { error: 'Failed to validate requested workspaces' },
                { status: 500 }
            );
        }

        if ((requestedDsos || []).length !== normalizedDsoIds.length) {
            return NextResponse.json(
                { error: 'One or more requested workspaces were not found' },
                { status: 404 }
            );
        }

        const invalidOrgDso = requestedDsos?.find((dso) => dso.org_id !== orgInfo.orgId);
        if (invalidOrgDso) {
            return NextResponse.json(
                { error: 'One or more requested workspaces are outside your organization' },
                { status: 403 }
            );
        }

        const accessChecks = await Promise.all(
            normalizedDsoIds.map((requestedDsoId) => checkDsoAccess(currentUser.id, requestedDsoId))
        );

        const canManageAllDsos = accessChecks.every(
            ({ hasAccess, role: callerRole }) => hasAccess && callerRole === 'admin'
        );

        if (!canManageAllDsos) {
            return NextResponse.json(
                { error: 'Admin access required for all requested workspaces' },
                { status: 403 }
            );
        }

        const existingUser = await findExistingUserByEmail(normalizedEmail);
        if (!existingUser) {
            return NextResponse.json(
                { error: `No existing user found for ${normalizedEmail}` },
                { status: 404 }
            );
        }

        await ensureOrgMembership(existingUser.id, orgInfo.orgId);

        const { data: existingAccessRows, error: existingAccessError } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id')
            .eq('user_id', existingUser.id)
            .in('dso_id', normalizedDsoIds);

        if (existingAccessError) {
            console.error('Error fetching existing workspace access:', existingAccessError);
            return NextResponse.json(
                { error: 'Failed to check existing workspace access' },
                { status: 500 }
            );
        }

        const existingAccessSet = new Set((existingAccessRows || []).map((row) => row.dso_id));
        const dsoIdsToAdd = normalizedDsoIds.filter((requestedDsoId) => !existingAccessSet.has(requestedDsoId));

        if (dsoIdsToAdd.length === 0) {
            return NextResponse.json(
                { error: 'User already has access to all requested workspaces' },
                { status: 409 }
            );
        }

        const { error: accessInsertError } = await supabaseAdmin
            .from('user_dso_access')
            .insert(
                dsoIdsToAdd.map((requestedDsoId) => ({
                    user_id: existingUser.id,
                    dso_id: requestedDsoId,
                    role,
                }))
            );

        if (accessInsertError) {
            console.error('Error adding workspace access:', accessInsertError);
            return NextResponse.json(
                { error: 'Failed to add user to the requested workspaces' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                member: {
                    email: existingUser.email,
                    role,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error adding team member:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
