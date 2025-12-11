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


export async function GET() {
    try {
        // TODO: Replace with actual Supabase query
        // const { data, error } = await supabase
        //     .from('user_dso_access')
        //     .select('*, users(*)')
        //     .eq('dso_id', currentDsoId);

        // Return 404 to trigger client-side fallback to show current user
        return NextResponse.json({ error: 'Not implemented' }, { status: 404 });
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

        // TODO: Replace with actual Supabase insert
        // 1. Check if user exists in Supabase Auth
        // 2. If exists, add to user_dso_access
        // 3. If not, create invite or return error

        // For now, return not implemented
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

