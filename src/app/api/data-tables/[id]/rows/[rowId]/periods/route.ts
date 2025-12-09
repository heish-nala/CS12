import { NextRequest, NextResponse } from 'next/server';
import {
    getPeriodDataByRow,
    getDataTableById,
    initializePeriodsForRow,
} from '@/lib/mock-data';

// GET /api/data-tables/[id]/rows/[rowId]/periods - Get all periods for a row
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    const { id: tableId, rowId } = await params;

    const table = getDataTableById(tableId);
    if (!table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    let periods = getPeriodDataByRow(tableId, rowId);

    console.log(`[PERIODS API] tableId=${tableId}, rowId=${rowId}, existing periods=${periods.length}, frequency=${table.time_tracking?.frequency}`);

    // If no periods exist and time tracking is enabled, initialize them
    if (periods.length === 0 && table.time_tracking?.enabled) {
        console.log(`[PERIODS API] Initializing new periods with frequency: ${table.time_tracking.frequency}`);
        periods = initializePeriodsForRow(tableId, rowId, table.time_tracking.frequency);
        console.log(`[PERIODS API] Created ${periods.length} periods, first label: ${periods[0]?.period_label}`);
    }

    return NextResponse.json(periods);
}
