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

// Mock team members for development
let mockTeamMembers: TeamMember[] = [
    {
        id: '1',
        user_id: 'user-1',
        email: 'alan@konekt.com',
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

export async function GET() {
    try {
        // TODO: Replace with actual Supabase query
        // const { data, error } = await supabase
        //     .from('user_dso_access')
        //     .select('*, users(*)')
        //     .eq('dso_id', currentDsoId);

        return NextResponse.json({ members: mockTeamMembers });
    } catch (error) {
        console.error('Error fetching team members:', error);
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

        // Check if email already exists
        if (mockTeamMembers.some(m => m.email.toLowerCase() === email.toLowerCase())) {
            return NextResponse.json(
                { error: 'User with this email is already a team member' },
                { status: 409 }
            );
        }

        // TODO: Replace with actual Supabase insert
        // 1. Check if user exists in Supabase Auth
        // 2. If exists, add to user_dso_access
        // 3. If not, create invite or return error

        const newMember: TeamMember = {
            id: `member-${Date.now()}`,
            user_id: `user-${Date.now()}`,
            email: email.toLowerCase(),
            name: name.trim(),
            role,
            created_at: new Date().toISOString(),
        };

        mockTeamMembers.push(newMember);

        return NextResponse.json(newMember, { status: 201 });
    } catch (error) {
        console.error('Error adding team member:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Export mockTeamMembers for use in other routes
export { mockTeamMembers };
