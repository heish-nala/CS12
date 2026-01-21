import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

// GET /api/data-tables/[id]/periods/batch - Get all periods for all rows in a table
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: tableId } = await params;

    // Verify table exists and get time tracking config
    const { data: table, error: tableError } = await supabaseAdmin
        .from('data_tables')
        .select('id, time_tracking')
        .eq('id', tableId)
        .single();

    if (tableError || !table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Fetch all periods for this table in a single query
    const { data: periods, error: periodsError } = await supabaseAdmin
        .from('period_data')
        .select('*')
        .eq('table_id', tableId)
        .order('period_start');

    if (periodsError) {
        console.log('Period data table may not exist:', periodsError.message);
        return NextResponse.json({});
    }

    // Group periods by row_id
    const groupedPeriods: Record<string, typeof periods> = {};

    if (periods) {
        for (const period of periods) {
            const rowId = period.row_id;
            if (!groupedPeriods[rowId]) {
                groupedPeriods[rowId] = [];
            }
            groupedPeriods[rowId].push(period);
        }
    }

    return NextResponse.json(groupedPeriods);
}
