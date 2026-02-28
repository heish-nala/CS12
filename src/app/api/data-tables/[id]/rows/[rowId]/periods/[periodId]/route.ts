import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgDsoAccess } from '@/lib/auth';

// GET /api/data-tables/[id]/rows/[rowId]/periods/[periodId] - Get a specific period
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string; periodId: string }> }
) {
    const { id, periodId } = await params;

    // Get table to check client_id for auth
    const { data: table } = await supabaseAdmin
        .from('data_tables')
        .select('client_id')
        .eq('id', id)
        .single();

    if (!table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Require org + DSO access (with user_id param fallback)
    const accessResult = await requireOrgDsoAccess(request, table.client_id);
    if ('response' in accessResult) {
        return accessResult.response;
    }

    const { data: period, error } = await supabaseAdmin
        .from('period_data')
        .select('*')
        .eq('id', periodId)
        .single();

    if (error || !period) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    return NextResponse.json(period);
}

// PUT /api/data-tables/[id]/rows/[rowId]/periods/[periodId] - Update period metrics
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string; periodId: string }> }
) {
    const { id, periodId } = await params;
    const body = await request.json();

    // Get table to check client_id for auth
    const { data: table } = await supabaseAdmin
        .from('data_tables')
        .select('client_id')
        .eq('id', id)
        .single();

    if (!table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Require write access to the client/DSO (with user_id fallback from body)
    const accessResult = await requireOrgDsoAccess(request, table.client_id, true, body);
    if ('response' in accessResult) {
        return accessResult.response;
    }

    const { metrics } = body;
    if (!metrics || typeof metrics !== 'object') {
        return NextResponse.json({ error: 'Metrics object required' }, { status: 400 });
    }

    // Get existing metrics to merge
    const { data: existing } = await supabaseAdmin
        .from('period_data')
        .select('metrics')
        .eq('id', periodId)
        .single();

    if (!existing) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Merge existing metrics with new values
    const mergedMetrics = { ...existing.metrics, ...metrics };

    const { data: updated, error: updateError } = await supabaseAdmin
        .from('period_data')
        .update({
            metrics: mergedMetrics,
            updated_at: new Date().toISOString(),
        })
        .eq('id', periodId)
        .select()
        .single();

    if (updateError) {
        console.error('Error updating period:', updateError);
        return NextResponse.json({ error: 'Failed to update period' }, { status: 500 });
    }

    return NextResponse.json(updated);
}

// DELETE /api/data-tables/[id]/rows/[rowId]/periods/[periodId] - Delete a period
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string; periodId: string }> }
) {
    const { id, periodId } = await params;

    // Get table to check client_id for auth
    const { data: table } = await supabaseAdmin
        .from('data_tables')
        .select('client_id')
        .eq('id', id)
        .single();

    if (!table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Require write access to the client/DSO (with user_id param fallback)
    const accessResult = await requireOrgDsoAccess(request, table.client_id, true);
    if ('response' in accessResult) {
        return accessResult.response;
    }

    const { error } = await supabaseAdmin
        .from('period_data')
        .delete()
        .eq('id', periodId);

    if (error) {
        console.error('Error deleting period:', error);
        return NextResponse.json({ error: 'Failed to delete period' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
