import { supabaseAdmin } from '@/lib/db/client';

// Status color → hex for chart rendering
const STATUS_COLOR_MAP: Record<string, string> = {
    default: '#9ca3af',
    gray: '#6b7280',
    brown: '#92400e',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#a855f7',
    pink: '#ec4899',
    red: '#ef4444',
};

export function getStatusOptions(col: { config: any }): Record<string, { label: string; color: string }> {
    const opts: Record<string, { label: string; color: string }> = {};
    const options = col.config?.options || col.config?.statusConfig?.options || [];
    for (const o of options) {
        opts[o.value] = { label: o.label, color: o.color || 'gray' };
    }
    return opts;
}

export function getStatusColorHex(color: string): string {
    return STATUS_COLOR_MAP[color] || STATUS_COLOR_MAP.gray;
}

interface AttendeeTable {
    tableId: string;
    statusCol: any;
    roleCol: any | undefined;
    blueprintCol: any;
    rows: any[];
    columns: any[];
    table: any;
}

export interface AttendeeTablesResult {
    tables: AttendeeTable[];
    allColumns: any[];
    allRows: any[];
}

/**
 * Find data_tables that are attendee trackers (have Status + Blueprint columns).
 */
export async function findAttendeeTables(clientId: string): Promise<AttendeeTablesResult> {
    const { data: tables, error: tablesError } = await supabaseAdmin
        .from('data_tables')
        .select('*')
        .eq('client_id', clientId)
        .order('order_index');

    if (tablesError) throw tablesError;

    if (!tables || tables.length === 0) {
        return { tables: [], allColumns: [], allRows: [] };
    }

    const tableIds = tables.map(t => t.id);

    const [columnsResult, rowsResult] = await Promise.all([
        supabaseAdmin
            .from('data_columns')
            .select('*')
            .in('table_id', tableIds)
            .order('order_index'),
        supabaseAdmin
            .from('data_rows')
            .select('*')
            .in('table_id', tableIds),
    ]);

    const allColumns = columnsResult.data || [];
    const allRows = rowsResult.data || [];

    const columnsByTable: Record<string, typeof allColumns> = {};
    for (const col of allColumns) {
        if (!columnsByTable[col.table_id]) columnsByTable[col.table_id] = [];
        columnsByTable[col.table_id].push(col);
    }
    const rowsByTable: Record<string, typeof allRows> = {};
    for (const row of allRows) {
        if (!rowsByTable[row.table_id]) rowsByTable[row.table_id] = [];
        rowsByTable[row.table_id].push(row);
    }

    const attendeeTables: AttendeeTable[] = [];

    for (const table of tables) {
        const cols = columnsByTable[table.id] || [];
        const statusCol = cols.find(c => c.name === 'Status' && c.type === 'status');
        const blueprintCol = cols.find(c => c.name === 'Blueprint' && c.type === 'percentage');

        if (statusCol && blueprintCol) {
            const roleCol = cols.find(c => c.name === 'Role' && c.type === 'status');
            attendeeTables.push({
                tableId: table.id,
                statusCol,
                roleCol,
                blueprintCol,
                rows: rowsByTable[table.id] || [],
                columns: cols,
                table,
            });
        }
    }

    return { tables: attendeeTables, allColumns, allRows };
}

export interface ClientDashboardMetrics {
    total_attendees: number;
    total_doctors: number;
    active_attendees: number;
    avg_blueprint: number;
    needs_attention: number;
    diagnosed: number;
    scans: number;
    accepted: number;
}

/**
 * Compute dashboard metrics for a single client from their attendee tracker data_tables.
 */
export async function computeClientMetrics(clientId: string): Promise<ClientDashboardMetrics> {
    const { tables: attendeeTables } = await findAttendeeTables(clientId);

    if (attendeeTables.length === 0) {
        return {
            total_attendees: 0,
            total_doctors: 0,
            active_attendees: 0,
            avg_blueprint: 0,
            needs_attention: 0,
            diagnosed: 0,
            scans: 0,
            accepted: 0,
        };
    }

    let totalAttendees = 0;
    let totalDoctors = 0;
    let activeAttendees = 0;
    const blueprintValues: number[] = [];
    let needsAttention = 0;

    for (const at of attendeeTables) {
        totalAttendees += at.rows.length;

        const statusOptions = getStatusOptions(at.statusCol);
        const roleOptions = at.roleCol ? getStatusOptions(at.roleCol) : {};

        for (const row of at.rows) {
            // Count doctors (rows with Role = Doctor, or all if no Role column)
            if (at.roleCol) {
                const roleVal = row.data?.[at.roleCol.id];
                if (roleVal) {
                    const opt = roleOptions[roleVal];
                    if (opt && opt.label.toLowerCase() === 'doctor') {
                        totalDoctors++;
                    }
                }
            } else {
                totalDoctors++;
            }

            // Active attendees (Status = Active)
            const statusVal = row.data?.[at.statusCol.id];
            if (statusVal) {
                const opt = statusOptions[statusVal];
                if (opt && opt.label.toLowerCase() === 'active') {
                    activeAttendees++;
                }
            }

            // Blueprint
            const bp = row.data?.[at.blueprintCol.id];
            if (bp !== null && bp !== undefined && bp !== '') {
                blueprintValues.push(Number(bp));
            }
        }
    }

    const avgBlueprint = blueprintValues.length > 0
        ? Math.round(blueprintValues.reduce((s, v) => s + v, 0) / blueprintValues.length)
        : 0;

    // Clinical totals from current month's period_data
    const now = new Date();
    const attendeeTableIds = attendeeTables.map(at => at.tableId);

    const { data: periodData } = await supabaseAdmin
        .from('period_data')
        .select('*')
        .in('table_id', attendeeTableIds)
        .gte('period_start', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
        .lte('period_end', new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString());

    // Resolve metric IDs to names using the time_tracking config
    const metricIdToName: Record<string, string> = {};
    for (const at of attendeeTables) {
        if (at.table.time_tracking?.metrics) {
            for (const m of at.table.time_tracking.metrics) {
                metricIdToName[m.id] = m.name.toLowerCase();
            }
        }
    }

    // Aggregate period metrics
    const metricTotals: Record<string, number> = {};
    for (const pd of (periodData || [])) {
        if (pd.metrics && typeof pd.metrics === 'object') {
            for (const [metricId, value] of Object.entries(pd.metrics)) {
                const name = metricIdToName[metricId] || metricId;
                metricTotals[name] = (metricTotals[name] || 0) + (Number(value) || 0);
            }
        }
    }

    // Needs attention: Blueprint >= 50% but current period Accepted = 0
    // We check per-row if their blueprint is high but they have no accepted cases this period
    const rowPeriodAccepted: Record<string, number> = {};
    for (const pd of (periodData || [])) {
        if (pd.metrics && typeof pd.metrics === 'object') {
            for (const [metricId, value] of Object.entries(pd.metrics)) {
                const name = metricIdToName[metricId] || metricId;
                if (name === 'accepted') {
                    const rowId = pd.row_id;
                    if (rowId) {
                        rowPeriodAccepted[rowId] = (rowPeriodAccepted[rowId] || 0) + (Number(value) || 0);
                    }
                }
            }
        }
    }

    for (const at of attendeeTables) {
        for (const row of at.rows) {
            const bp = row.data?.[at.blueprintCol.id];
            if (bp !== null && bp !== undefined && bp !== '') {
                const bpNum = Number(bp);
                if (bpNum >= 50 && (!rowPeriodAccepted[row.id] || rowPeriodAccepted[row.id] === 0)) {
                    needsAttention++;
                }
            }
        }
    }

    return {
        total_attendees: totalAttendees,
        total_doctors: totalDoctors,
        active_attendees: activeAttendees,
        avg_blueprint: avgBlueprint,
        needs_attention: needsAttention,
        diagnosed: metricTotals['diagnosed'] || 0,
        scans: metricTotals['scans'] || 0,
        accepted: metricTotals['accepted'] || 0,
    };
}
