import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { UserRole } from '@/lib/db/types';

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
        const userId = searchParams.get('user_id');

        if (!userId) {
            return NextResponse.json(
                { error: 'user_id is required' },
                { status: 400 }
            );
        }

        // Get all DSOs the current user has access to
        const { data: userAccess, error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id')
            .eq('user_id', userId);

        if (accessError) {
            console.error('Error fetching user access:', accessError);
            return NextResponse.json(
                { error: 'Failed to fetch user access' },
                { status: 500 }
            );
        }

        if (!userAccess || userAccess.length === 0) {
            // No workspaces - return just the current user
            return NextResponse.json({ members: [] });
        }

        const dsoIds = userAccess.map(a => a.dso_id);

        // Get all team members who have access to any of the user's workspaces
        const { data: teamAccess, error: teamError } = await supabaseAdmin
            .from('user_dso_access')
            .select('id, user_id, role, created_at, dso_id')
            .in('dso_id', dsoIds);

        if (teamError) {
            console.error('Error fetching team members:', teamError);
            return NextResponse.json(
                { error: 'Failed to fetch team members' },
                { status: 500 }
            );
        }

        if (!teamAccess || teamAccess.length === 0) {
            return NextResponse.json({ members: [] });
        }

        // Get unique user IDs
        const uniqueUserIds = [...new Set(teamAccess.map(a => a.user_id))];

        // Try to get user emails from auth.users via admin API
        // Since we can't directly query auth.users, we'll use the user_id as identifier
        // In a production app, you'd have a user_profiles table

        // For now, we'll construct members with the user_id
        // The best role is the highest role across all workspaces
        const membersByUserId = new Map<string, {
            id: string;
            user_id: string;
            role: UserRole;
            created_at: string
        }>();

        const roleOrder: Record<UserRole, number> = { admin: 3, manager: 2, viewer: 1 };

        for (const access of teamAccess) {
            const existing = membersByUserId.get(access.user_id);
            if (!existing || roleOrder[access.role as UserRole] > roleOrder[existing.role]) {
                membersByUserId.set(access.user_id, {
                    id: access.id,
                    user_id: access.user_id,
                    role: access.role as UserRole,
                    created_at: access.created_at,
                });
            }
        }

        // Try to get user info from Supabase Auth admin API
        const members: TeamMember[] = [];

        for (const [uid, access] of membersByUserId) {
            try {
                const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(uid);

                if (userData?.user) {
                    const email = userData.user.email || uid;
                    const name = userData.user.user_metadata?.name ||
                                 userData.user.user_metadata?.full_name ||
                                 email.split('@')[0];

                    members.push({
                        id: access.id,
                        user_id: uid,
                        email: email,
                        name: name.charAt(0).toUpperCase() + name.slice(1),
                        role: access.role,
                        created_at: access.created_at,
                        is_current_user: uid === userId,
                    });
                } else {
                    // Fallback if we can't get user info
                    members.push({
                        id: access.id,
                        user_id: uid,
                        email: uid,
                        name: 'Unknown User',
                        role: access.role,
                        created_at: access.created_at,
                        is_current_user: uid === userId,
                    });
                }
            } catch (error) {
                // If admin API fails, use fallback
                members.push({
                    id: access.id,
                    user_id: uid,
                    email: uid,
                    name: 'Unknown User',
                    role: access.role,
                    created_at: access.created_at,
                    is_current_user: uid === userId,
                });
            }
        }

        // Sort: current user first, then by name
        members.sort((a, b) => {
            if (a.is_current_user) return -1;
            if (b.is_current_user) return 1;
            return a.name.localeCompare(b.name);
        });

        return NextResponse.json({ members });
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
