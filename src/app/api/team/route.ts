import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { UserRole } from '@/lib/db/types';
import { requireAuth, getUserOrg } from '@/lib/auth';

interface TeamMember {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: UserRole;
    created_at: string;
    is_current_user?: boolean;
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
            .select('id, user_id, role, joined_at, user_profiles(*)')
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

        // Try to get user info from Supabase Auth admin API
        const members: TeamMember[] = [];

        for (const member of orgMembers) {
            const uid = member.user_id;
            // Use user_profiles if available, otherwise fall back to auth admin API
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const profile = member.user_profiles as any;
            if (profile?.email) {
                const email = profile.email;
                const name = profile.display_name || email.split('@')[0];
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
        // Require authentication
        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;
        }

        const body = await request.json();
        const { email, name, role } = body;

        // Validate input
        if (!email || !name || !role) {
            return NextResponse.json(
                { error: 'Email, name, and role are required' },
                { status: 400 }
            );
        }

        // Check valid role
        if (!['admin', 'manager', 'viewer'].includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be admin, manager, or viewer' },
                { status: 400 }
            );
        }

        // TODO: Implement actual team member addition
        // This requires:
        // 1. Finding or inviting the user by email
        // 2. Adding them to user_dso_access for specific workspace(s)

        return NextResponse.json(
            { error: 'Team member management not yet implemented' },
            { status: 501 }
        );
    } catch (error) {
        console.error('Error adding team member:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
