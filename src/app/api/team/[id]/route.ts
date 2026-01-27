import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { UserRole } from '@/lib/db/types';
import { requireAuth, checkDsoAccess } from '@/lib/auth';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require authentication
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const currentUser = authResult.user;

        const { id } = await params;
        const body = await request.json();
        const { role } = body;

        // Validate role
        const validRoles: UserRole[] = ['admin', 'manager', 'viewer'];
        if (!role || !validRoles.includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be admin, manager, or viewer' },
                { status: 400 }
            );
        }

        // Get the current member to check their role
        const { data: member, error: fetchError } = await supabaseAdmin
            .from('user_dso_access')
            .select('id, user_id, role, dso_id')
            .eq('id', id)
            .single();

        if (fetchError || !member) {
            return NextResponse.json(
                { error: 'Team member not found' },
                { status: 404 }
            );
        }

        // Verify current user has admin access to this DSO
        const { hasAccess, role: callerRole } = await checkDsoAccess(currentUser.id, member.dso_id);
        if (!hasAccess || callerRole !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required to manage team members' },
                { status: 403 }
            );
        }

        // If demoting an admin, check if they're the last one
        if (member.role === 'admin' && role !== 'admin') {
            const { data: admins, error: countError } = await supabaseAdmin
                .from('user_dso_access')
                .select('id')
                .eq('dso_id', member.dso_id)
                .eq('role', 'admin');

            if (!countError && admins && admins.length <= 1) {
                return NextResponse.json(
                    { error: 'Cannot change role. At least one admin is required.' },
                    { status: 400 }
                );
            }
        }

        // Update the role
        const { error: updateError } = await supabaseAdmin
            .from('user_dso_access')
            .update({ role })
            .eq('id', id);

        if (updateError) {
            console.error('Error updating role:', updateError);
            return NextResponse.json(
                { error: 'Failed to update role' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, role });
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
        // Require authentication
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const currentUser = authResult.user;

        const { id } = await params;

        // Get the member to check their role
        const { data: member, error: fetchError } = await supabaseAdmin
            .from('user_dso_access')
            .select('id, user_id, role, dso_id')
            .eq('id', id)
            .single();

        if (fetchError || !member) {
            return NextResponse.json(
                { error: 'Team member not found' },
                { status: 404 }
            );
        }

        // Verify current user has admin access to this DSO
        const { hasAccess, role: callerRole } = await checkDsoAccess(currentUser.id, member.dso_id);
        if (!hasAccess || callerRole !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required to remove team members' },
                { status: 403 }
            );
        }

        // Prevent removing the last admin
        if (member.role === 'admin') {
            const { data: admins, error: countError } = await supabaseAdmin
                .from('user_dso_access')
                .select('id')
                .eq('dso_id', member.dso_id)
                .eq('role', 'admin');

            if (!countError && admins && admins.length <= 1) {
                return NextResponse.json(
                    { error: 'Cannot remove the last admin.' },
                    { status: 400 }
                );
            }
        }

        // Delete the access record
        const { error: deleteError } = await supabaseAdmin
            .from('user_dso_access')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error removing member:', deleteError);
            return NextResponse.json(
                { error: 'Failed to remove team member' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing team member:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
