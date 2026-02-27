import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgAccess } from '@/lib/auth';

/**
 * GET /api/orgs/[id]/dsos
 * List all DSOs belonging to the organization.
 * Any member of the org can view this list (used by admins in the settings UI
 * to see all DSOs regardless of their personal user_dso_access assignments).
 *
 * Unlike GET /api/dsos (which filters by user_dso_access), this returns ALL
 * non-archived DSOs in the org — giving admins full visibility for assignment.
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

    const { data: dsos, error } = await supabaseAdmin
        .from('dsos')
        .select('*')
        .eq('org_id', id)
        .or('archived.is.null,archived.eq.false')
        .order('name');

    if (error) {
        console.error('Failed to fetch org DSOs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch DSOs' },
            { status: 500 }
        );
    }

    return NextResponse.json({ dsos });
}
