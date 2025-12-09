import { NextRequest, NextResponse } from 'next/server';
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

// In-memory store (shared with main route in real app via database)
let mockTeamMembers: TeamMember[] = [
    {
        id: '1',
        user_id: 'user-1',
        email: 'alan@cs12.com',
        name: 'Alan',
        role: 'admin',
        created_at: '2024-01-15T00:00:00Z',
        is_current_user: true,
    },
    {
        id: '2',
        user_id: 'user-2',
        email: 'sarah@acmedental.com',
        name: 'Sarah Johnson',
        role: 'manager',
        created_at: '2024-02-20T00:00:00Z',
    },
    {
        id: '3',
        user_id: 'user-3',
        email: 'mike@acmedental.com',
        name: 'Mike Chen',
        role: 'viewer',
        created_at: '2024-03-10T00:00:00Z',
    },
];

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { role } = body;

        // Validate role
        if (!role || !['admin', 'manager', 'viewer'].includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be admin, manager, or viewer' },
                { status: 400 }
            );
        }

        // Find member
        const memberIndex = mockTeamMembers.findIndex(m => m.id === id);
        if (memberIndex === -1) {
            return NextResponse.json(
                { error: 'Team member not found' },
                { status: 404 }
            );
        }

        const member = mockTeamMembers[memberIndex];

        // Prevent demoting the last admin
        if (member.role === 'admin' && role !== 'admin') {
            const adminCount = mockTeamMembers.filter(m => m.role === 'admin').length;
            if (adminCount <= 1) {
                return NextResponse.json(
                    { error: 'Cannot change role. At least one admin is required.' },
                    { status: 400 }
                );
            }
        }

        // TODO: Replace with actual Supabase update
        // const { error } = await supabase
        //     .from('user_dso_access')
        //     .update({ role })
        //     .eq('id', id);

        mockTeamMembers[memberIndex] = { ...member, role };

        return NextResponse.json(mockTeamMembers[memberIndex]);
    } catch (error) {
        console.error('Error updating team member:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Find member
        const memberIndex = mockTeamMembers.findIndex(m => m.id === id);
        if (memberIndex === -1) {
            return NextResponse.json(
                { error: 'Team member not found' },
                { status: 404 }
            );
        }

        const member = mockTeamMembers[memberIndex];

        // Prevent removing the last admin
        if (member.role === 'admin') {
            const adminCount = mockTeamMembers.filter(m => m.role === 'admin').length;
            if (adminCount <= 1) {
                return NextResponse.json(
                    { error: 'Cannot remove the last admin.' },
                    { status: 400 }
                );
            }
        }

        // Prevent removing yourself (in real app, check current user)
        if (member.is_current_user) {
            return NextResponse.json(
                { error: 'You cannot remove yourself from the team.' },
                { status: 400 }
            );
        }

        // TODO: Replace with actual Supabase delete
        // const { error } = await supabase
        //     .from('user_dso_access')
        //     .delete()
        //     .eq('id', id);

        mockTeamMembers = mockTeamMembers.filter(m => m.id !== id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing team member:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
