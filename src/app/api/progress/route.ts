import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireDsoAccessWithFallback } from '@/lib/auth';

// GET /api/progress?client_id=xxx - Get all progress data in ONE request
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('client_id');

        if (!clientId) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        // Require access to the client/DSO
        const accessResult = await requireDsoAccessWithFallback(request, clientId);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        // Step 1: Fetch all tables with time tracking enabled for this client
        const { data: tables, error: tablesError } = await supabaseAdmin
            .from('data_tables')
            .select('*')
            .eq('client_id', clientId)
            .not('time_tracking', 'is', null)
            .order('order_index');

        if (tablesError) throw tablesError;

        // Filter to only tables where time_tracking.enabled is true
        const timeTrackingTables = (tables || []).filter(
            t => t.time_tracking?.enabled === true
        );

        if (timeTrackingTables.length === 0) {
            return NextResponse.json({ tables: [], contacts: [] });
        }

        const tableIds = timeTrackingTables.map(t => t.id);

        // Step 2: Fetch ALL related data in PARALLEL with single queries
        // Only fetch the columns we actually need to reduce data transfer
        const [columnsResult, rowsResult, periodsResult] = await Promise.all([
            // All columns for all time-tracking tables (need id, table_id, type, is_primary, order_index)
            supabaseAdmin
                .from('data_columns')
                .select('id, table_id, type, is_primary, order_index')
                .in('table_id', tableIds)
                .order('order_index'),

            // All rows for all time-tracking tables (need id, table_id, data, updated_at)
            supabaseAdmin
                .from('data_rows')
                .select('id, table_id, data, updated_at')
                .in('table_id', tableIds)
                .order('created_at'),

            // All period data for all time-tracking tables (need key fields only)
            supabaseAdmin
                .from('period_data')
                .select('id, table_id, row_id, period_start, period_end, period_label, metrics')
                .in('table_id', tableIds)
                .order('period_start'),
        ]);

        // Step 3: Group data by table_id and row_id for quick lookups
        const columnsByTableId: Record<string, any[]> = {};
        for (const col of columnsResult.data || []) {
            if (!columnsByTableId[col.table_id]) columnsByTableId[col.table_id] = [];
            columnsByTableId[col.table_id]!.push(col);
        }

        const rowsByTableId: Record<string, any[]> = {};
        for (const row of rowsResult.data || []) {
            if (!rowsByTableId[row.table_id]) rowsByTableId[row.table_id] = [];
            rowsByTableId[row.table_id]!.push(row);
        }

        // Group periods by table_id, then by row_id
        const periodsByTableAndRow: Record<string, Record<string, any[]>> = {};
        for (const period of periodsResult.data || []) {
            if (!periodsByTableAndRow[period.table_id]) {
                periodsByTableAndRow[period.table_id] = {};
            }
            if (!periodsByTableAndRow[period.table_id][period.row_id]) {
                periodsByTableAndRow[period.table_id][period.row_id] = [];
            }
            periodsByTableAndRow[period.table_id][period.row_id].push(period);
        }

        // Step 4: Build contacts list
        const today = new Date();
        const contacts: any[] = [];

        for (const table of timeTrackingTables) {
            const columns = columnsByTableId[table.id] || [];
            const rows = rowsByTableId[table.id] || [];
            const periodsByRow = periodsByTableAndRow[table.id] || {};

            const primaryColumn = columns.find(c => c.is_primary);
            const nameColumnId = primaryColumn?.id || columns[0]?.id;
            const emailColumn = columns.find(c => c.type === 'email');
            const phoneColumn = columns.find(c => c.type === 'phone');
            const metrics = table.time_tracking?.metrics || [];

            for (const row of rows) {
                const name = row.data?.[nameColumnId];
                if (!name) continue;

                const rowPeriods = periodsByRow[row.id] || [];

                // Find current and previous period
                const currentPeriodIdx = rowPeriods.findIndex(p => {
                    const start = new Date(p.period_start + 'T12:00:00');
                    const end = new Date(p.period_end + 'T12:00:00');
                    return today >= start && today <= end;
                });

                const currentPeriod = currentPeriodIdx >= 0 ? rowPeriods[currentPeriodIdx] : null;
                const previousPeriod = currentPeriodIdx > 0 ? rowPeriods[currentPeriodIdx - 1] : null;

                // Calculate totals
                const calcTotal = (p: any) => {
                    if (!p?.metrics) return 0;
                    return Object.values(p.metrics).reduce((sum: number, val: any) => sum + (val || 0), 0);
                };

                // Build metrics summary with names
                const metricsSummary: Record<string, number> = {};
                if (currentPeriod?.metrics) {
                    for (const metric of metrics) {
                        metricsSummary[metric.name] = currentPeriod.metrics[metric.id] || 0;
                    }
                }

                contacts.push({
                    id: `${table.id}-${row.id}`,
                    rowId: row.id,
                    tableId: table.id,
                    name: String(name),
                    email: emailColumn ? String(row.data?.[emailColumn.id] || '') : undefined,
                    phone: phoneColumn ? String(row.data?.[phoneColumn.id] || '') : undefined,
                    tableName: table.name,
                    lastUpdated: row.updated_at,
                    currentPeriodTotal: calcTotal(currentPeriod),
                    currentPeriodLabel: currentPeriod?.period_label,
                    previousPeriodTotal: calcTotal(previousPeriod),
                    metricsSummary,
                });
            }
        }

        // Return tables with columns for reference
        const tablesWithColumns = timeTrackingTables.map(table => ({
            ...table,
            columns: columnsByTableId[table.id] || [],
            rows: rowsByTableId[table.id] || [],
        }));

        const response = NextResponse.json({
            tables: tablesWithColumns,
            contacts,
        });

        // Cache for 30 seconds, allow stale for 60 seconds while revalidating
        response.headers.set('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=60');

        return response;
    } catch (error) {
        console.error('Error fetching progress data:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
