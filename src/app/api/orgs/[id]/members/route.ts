import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgAccess } from '@/lib/auth';
import { isValidOrgRole } from '@/lib/org-utils';

/**
 * GET /api/orgs/[id]/members
 * List all members of the organization with their profiles.
 * Any member of the org can view the member list.
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

    const { data: members, error } = await supabaseAdmin
        .from('org_members')
        .select('*, user_profiles(*)')
        .eq('org_id', id)
        .order('joined_at', { ascending: true });

    if (error) {
        console.error('Failed to fetch org members:', error);
        return NextResponse.json(
            { error: 'Failed to fetch members' },
            { status: 500 }
        );
    }

    return NextResponse.json({ members });
}

/**
 * POST /api/orgs/[id]/members
 * Add a member to the organization.
 * Only owners and admins can add members.
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

    let body: { user_id?: string; role?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }

    const { user_id, role: rawRole } = body;

    if (!user_id) {
        return NextResponse.json(
            { error: 'user_id is required' },
            { status: 400 }
        );
    }

    // Default to 'member' if role not provided; validate if provided
    const role = rawRole ?? 'member';
    if (!isValidOrgRole(role)) {
        return NextResponse.json(
            { error: `Invalid role. Must be one of: owner, admin, member` },
            { status: 400 }
        );
    }

    // Check if user is already a member
    const { data: existing } = await supabaseAdmin
        .from('org_members')
        .select('id')
        .eq('org_id', id)
        .eq('user_id', user_id)
        .single();

    if (existing) {
        return NextResponse.json(
            { error: 'User is already a member of this organization' },
            { status: 409 }
        );
    }

    const { data: member, error } = await supabaseAdmin
        .from('org_members')
        .insert({ org_id: id, user_id, role })
        .select()
        .single();

    if (error) {
        console.error('Failed to add org member:', error);
        return NextResponse.json(
            { error: 'Failed to add member' },
            { status: 500 }
        );
    }

    return NextResponse.json({ member }, { status: 201 });
}

/**
 * DELETE /api/orgs/[id]/members
 * Remove a member from the organization.
 * Only owners and admins can remove members.
 * Rejects removing the last owner (zero-owner guard).
 *
 * Query param: ?user_id=<uuid>
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authResult = await requireOrgAccess(request, id, true);
    if (authResult.response) {
        return authResult.response;
    }

    const targetUserId = new URL(request.url).searchParams.get('user_id');

    if (!targetUserId) {
        return NextResponse.json(
            { error: 'user_id query parameter is required' },
            { status: 400 }
        );
    }

    // Check the target member's current role
    const { data: targetMember } = await supabaseAdmin
        .from('org_members')
        .select('role')
        .eq('org_id', id)
        .eq('user_id', targetUserId)
        .single();

    if (!targetMember) {
        return NextResponse.json(
            { error: 'User is not a member of this organization' },
            { status: 404 }
        );
    }

    // Zero-owner guard (MBR-08): prevent removing the last owner
    if (targetMember.role === 'owner') {
        const { count } = await supabaseAdmin
            .from('org_members')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', id)
            .eq('role', 'owner');

        if (count !== null && count <= 1) {
            return NextResponse.json(
                { error: 'Cannot remove the last owner of an organization. Transfer ownership first.' },
                { status: 403 }
            );
        }
    }

    const { error: deleteError } = await supabaseAdmin
        .from('org_members')
        .delete()
        .eq('org_id', id)
        .eq('user_id', targetUserId);

    if (deleteError) {
        console.error('Failed to remove org member:', deleteError);
        return NextResponse.json(
            { error: 'Failed to remove member' },
            { status: 500 }
        );
    }

    return NextResponse.json({ success: true });
}
