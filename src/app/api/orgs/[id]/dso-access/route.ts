import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgAccess } from '@/lib/auth';

/**
 * GET /api/orgs/[id]/dso-access
 * List all user_dso_access rows for DSOs belonging to this org.
 * Returns a flat list of { user_id, dso_id, role } — callers build lookup maps.
 * Only owners and admins can view the full member-to-DSO assignment matrix.
 *
 * NOTE: This route operates on user_dso_access (the bridge table from the
 * pre-org model). It will be deprecated in Phase 5 when user_dso_access is removed.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const authResult = await requireOrgAccess(request, id, true);
    if (authResult.response) {
        return authResult.response;
    }

    // Get all DSO IDs in this org
    const { data: dsos, error: dsoError } = await supabaseAdmin
        .from('dsos')
        .select('id')
        .eq('org_id', id);

    if (dsoError) {
        console.error('Failed to fetch org DSOs for access lookup:', dsoError);
        return NextResponse.json(
            { error: 'Failed to fetch DSO access' },
            { status: 500 }
        );
    }

    const dsoIds = (dsos || []).map((d: { id: string }) => d.id);

    // Guard: avoid .in() with empty array — Supabase throws on empty set
    if (dsoIds.length === 0) {
        return NextResponse.json({ access: [] });
    }

    const { data: access, error } = await supabaseAdmin
        .from('user_dso_access')
        .select('user_id, dso_id, role')
        .in('dso_id', dsoIds);

    if (error) {
        console.error('Failed to fetch DSO access:', error);
        return NextResponse.json(
            { error: 'Failed to fetch DSO access' },
            { status: 500 }
        );
    }

    return NextResponse.json({ access });
}

/**
 * POST /api/orgs/[id]/dso-access
 * Grant a member access to a DSO within this org.
 * Body: { user_id: string, dso_id: string, role?: string }
 * Default role is 'viewer' (least-privilege).
 * Only owners and admins can grant access.
 *
 * Validates:
 * - DSO belongs to this org (prevents cross-org access grants)
 * - User is a member of this org (prevents granting access to outsiders)
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

    let body: { user_id?: string; dso_id?: string; role?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }

    const { user_id, dso_id, role = 'viewer' } = body;

    if (!user_id || !dso_id) {
        return NextResponse.json(
            { error: 'user_id and dso_id are required' },
            { status: 400 }
        );
    }

    // Validate DSO belongs to this org (prevent cross-org access grants)
    const { data: dso } = await supabaseAdmin
        .from('dsos')
        .select('id')
        .eq('id', dso_id)
        .eq('org_id', id)
        .single();

    if (!dso) {
        return NextResponse.json(
            { error: 'DSO not in this organization' },
            { status: 403 }
        );
    }

    // Validate user is an org member (prevent granting access to outsiders)
    const { data: member } = await supabaseAdmin
        .from('org_members')
        .select('id')
        .eq('org_id', id)
        .eq('user_id', user_id)
        .single();

    if (!member) {
        return NextResponse.json(
            { error: 'User is not a member of this organization' },
            { status: 400 }
        );
    }

    const { error } = await supabaseAdmin
        .from('user_dso_access')
        .insert({ user_id, dso_id, role });

    if (error?.code === '23505') {
        return NextResponse.json(
            { error: 'User already has access to this DSO' },
            { status: 409 }
        );
    }

    if (error) {
        console.error('Failed to grant DSO access:', error);
        return NextResponse.json(
            { error: 'Failed to grant DSO access' },
            { status: 500 }
        );
    }

    return NextResponse.json({ success: true }, { status: 201 });
}

/**
 * DELETE /api/orgs/[id]/dso-access
 * Revoke a member's access to a DSO within this org.
 * Query params: ?user_id=<uuid>&dso_id=<uuid>
 * Only owners and admins can revoke access.
 *
 * Validates DSO belongs to this org before deleting.
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const dsoId = searchParams.get('dso_id');

    if (!userId || !dsoId) {
        return NextResponse.json(
            { error: 'user_id and dso_id query parameters are required' },
            { status: 400 }
        );
    }

    // Validate DSO belongs to this org (prevent cross-org revocations)
    const { data: dso } = await supabaseAdmin
        .from('dsos')
        .select('id')
        .eq('id', dsoId)
        .eq('org_id', id)
        .single();

    if (!dso) {
        return NextResponse.json(
            { error: 'DSO not in this organization' },
            { status: 403 }
        );
    }

    const { error } = await supabaseAdmin
        .from('user_dso_access')
        .delete()
        .eq('user_id', userId)
        .eq('dso_id', dsoId);

    if (error) {
        console.error('Failed to remove DSO access:', error);
        return NextResponse.json(
            { error: 'Failed to remove DSO access' },
            { status: 500 }
        );
    }

    return NextResponse.json({ success: true });
}
