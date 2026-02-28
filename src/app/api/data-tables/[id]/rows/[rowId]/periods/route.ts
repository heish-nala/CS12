import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgDsoAccess } from '@/lib/auth';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

// GET /api/data-tables/[id]/rows/[rowId]/periods
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    const { id: tableId, rowId } = await params;

    // Get table with time tracking config and client_id
    const { data: table, error: tableError } = await supabaseAdmin
        .from('data_tables')
        .select('id, client_id, time_tracking')
        .eq('id', tableId)
        .single();

    if (tableError || !table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Require org + DSO access (with user_id param fallback for GET)
    const accessResult = await requireOrgDsoAccess(request, table.client_id);
    if ('response' in accessResult) {
        return accessResult.response;
    }

    if (!table.time_tracking?.enabled || table.time_tracking.frequency !== 'monthly') {
        return NextResponse.json([]);
    }

    // Calculate the last 12 months (including current)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const last12Months: { year: number; month: number; key: string }[] = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        last12Months.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            key: `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
        });
    }

    // Fetch existing periods
    const { data: existingPeriods, error: periodsError } = await supabaseAdmin
        .from('period_data')
        .select('*')
        .eq('table_id', tableId)
        .eq('row_id', rowId);

    if (periodsError) {
        console.error('Error fetching periods:', periodsError);
        return NextResponse.json([]);
    }

    // Index existing periods by year-month key
    // Parse date string directly to avoid timezone issues
    const periodsByKey = new Map<string, any>();
    for (const p of existingPeriods || []) {
        const [year, month] = p.period_start.split('-');
        const key = `${year}-${String(parseInt(month, 10) - 1).padStart(2, '0')}`;
        // Only keep if it's in our last 12 months window
        if (last12Months.some(m => m.key === key)) {
            // If duplicate, keep the one with more data or the newer one
            if (!periodsByKey.has(key)) {
                periodsByKey.set(key, p);
            }
        }
    }

    // Create missing periods
    const periodsToCreate: any[] = [];
    for (const { year, month, key } of last12Months) {
        if (!periodsByKey.has(key)) {
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0);

            const metricsData: Record<string, number> = {};
            table.time_tracking.metrics?.forEach((metric: any) => {
                metricsData[metric.id] = 0;
            });

            periodsToCreate.push({
                table_id: tableId,
                row_id: rowId,
                period_start: startDate.toISOString().split('T')[0],
                period_end: endDate.toISOString().split('T')[0],
                period_label: MONTH_NAMES[month],
                metrics: metricsData,
            });
        }
    }

    if (periodsToCreate.length > 0) {
        const { data: newPeriods, error: insertError } = await supabaseAdmin
            .from('period_data')
            .insert(periodsToCreate)
            .select();

        if (insertError) {
            console.error('Error creating periods:', insertError);
        } else if (newPeriods) {
            for (const p of newPeriods) {
                const [year, month] = p.period_start.split('-');
                const key = `${year}-${String(parseInt(month, 10) - 1).padStart(2, '0')}`;
                periodsByKey.set(key, p);
            }
        }
    }

    // Build result array in chronological order (oldest first, newest last)
    const result: any[] = [];
    for (const { key } of last12Months) {
        const period = periodsByKey.get(key);
        if (period) {
            result.push(period);
        }
    }

    return NextResponse.json(result);
}
