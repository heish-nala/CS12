import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgDsoAccess } from '@/lib/auth';
import { OverviewDashboardResponse } from '@/lib/db/types';
import { findAttendeeTables, getStatusOptions, getStatusColorHex } from '@/lib/attendee-tracker';

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

        // Auth check
        const accessResult = await requireOrgDsoAccess(request, clientId);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        // Use shared attendee tracker detection
        const { tables: attendeeTables } = await findAttendeeTables(clientId);

        if (attendeeTables.length === 0) {
            return NextResponse.json(emptyDashboard());
        }

        // ── Compute metrics across all attendee tables ──

        let totalAttendees = 0;
        const statusCounts: Record<string, { label: string; value: number; color: string }> = {};
        const roleCounts: Record<string, { label: string; value: number; color: string }> = {};
        const blueprintValues: number[] = [];

        for (const at of attendeeTables) {
            totalAttendees += at.rows.length;

            // Status options map (value → label/color)
            const statusOptions = getStatusOptions(at.statusCol);

            // Role options map
            const roleOptions = at.roleCol ? getStatusOptions(at.roleCol) : {};

            for (const row of at.rows) {
                // Status
                const statusVal = row.data?.[at.statusCol.id];
                if (statusVal) {
                    const opt = statusOptions[statusVal] || { label: statusVal, color: 'gray' };
                    if (!statusCounts[statusVal]) {
                        statusCounts[statusVal] = { label: opt.label, value: 0, color: getStatusColorHex(opt.color) };
                    }
                    statusCounts[statusVal].value++;
                }

                // Role
                if (at.roleCol) {
                    const roleVal = row.data?.[at.roleCol.id];
                    if (roleVal) {
                        const opt = roleOptions[roleVal] || { label: roleVal, color: 'gray' };
                        if (!roleCounts[roleVal]) {
                            roleCounts[roleVal] = { label: opt.label, value: 0, color: getStatusColorHex(opt.color) };
                        }
                        roleCounts[roleVal].value++;
                    }
                }

                // Blueprint
                const bp = row.data?.[at.blueprintCol.id];
                if (bp !== null && bp !== undefined && bp !== '') {
                    blueprintValues.push(Number(bp));
                }
            }
        }

        // Sort by value descending
        const attendeesByStatus = Object.values(statusCounts).sort((a, b) => b.value - a.value);
        const attendeesByRole = Object.values(roleCounts).sort((a, b) => b.value - a.value);

        // Blueprint distribution
        const avgBlueprint = blueprintValues.length > 0
            ? Math.round(blueprintValues.reduce((s, v) => s + v, 0) / blueprintValues.length)
            : 0;

        const bpDistribution = [
            { label: '0-25%', value: 0, color: getStatusColorHex('gray') },
            { label: '26-50%', value: 0, color: getStatusColorHex('yellow') },
            { label: '51-75%', value: 0, color: getStatusColorHex('blue') },
            { label: '76-100%', value: 0, color: getStatusColorHex('green') },
        ];
        for (const v of blueprintValues) {
            if (v <= 25) bpDistribution[0].value++;
            else if (v <= 50) bpDistribution[1].value++;
            else if (v <= 75) bpDistribution[2].value++;
            else bpDistribution[3].value++;
        }

        // ── Clinical funnel from period_data ──

        // Get the current month's period data across all attendee table rows
        const now = new Date();
        const currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const attendeeTableIds = attendeeTables.map(at => at.tableId);
        const { data: periodData } = await supabaseAdmin
            .from('period_data')
            .select('*')
            .in('table_id', attendeeTableIds)
            .gte('period_start', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
            .lte('period_end', new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString());

        // Aggregate period metrics by metric name
        const metricTotals: Record<string, number> = {};
        for (const pd of (periodData || [])) {
            if (pd.metrics && typeof pd.metrics === 'object') {
                for (const [metricId, value] of Object.entries(pd.metrics)) {
                    metricTotals[metricId] = (metricTotals[metricId] || 0) + (Number(value) || 0);
                }
            }
        }

        // Resolve metric IDs to names using the time_tracking config from tables
        const metricIdToName: Record<string, string> = {};
        for (const at of attendeeTables) {
            if (at.table.time_tracking?.metrics) {
                for (const m of at.table.time_tracking.metrics) {
                    metricIdToName[m.id] = m.name;
                }
            }
        }

        // Build clinical funnel stages sorted by value desc
        const funnelStages: Array<{ label: string; value: number }> = [];
        for (const [metricId, total] of Object.entries(metricTotals)) {
            const name = metricIdToName[metricId] || metricId;
            funnelStages.push({ label: name, value: total });
        }
        funnelStages.sort((a, b) => b.value - a.value);

        // ── Activity summary for current month ──

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data: activities } = await supabaseAdmin
            .from('activities')
            .select('activity_type, created_at')
            .eq('client_id', clientId)
            .gte('created_at', monthStart)
            .order('created_at', { ascending: false });

        const activityByType: Record<string, number> = {};
        for (const act of (activities || [])) {
            const t = act.activity_type || 'other';
            activityByType[t] = (activityByType[t] || 0) + 1;
        }

        const actByTypeArr = Object.entries(activityByType)
            .map(([label, value]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), value }))
            .sort((a, b) => b.value - a.value);

        const lastContact = activities && activities.length > 0 ? activities[0].created_at : null;

        const response: OverviewDashboardResponse = {
            total_attendees: totalAttendees,
            attendees_by_status: attendeesByStatus,
            attendees_by_role: attendeesByRole,
            blueprint_completion: {
                average_percent: avgBlueprint,
                total_with_blueprint: blueprintValues.length,
                distribution: bpDistribution,
            },
            clinical_funnel: {
                period_label: currentMonth,
                stages: funnelStages,
            },
            activity_summary: {
                total_this_month: (activities || []).length,
                last_contact_date: lastContact,
                by_type: actByTypeArr,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error computing overview dashboard:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

function emptyDashboard(): OverviewDashboardResponse {
    return {
        total_attendees: 0,
        attendees_by_status: [],
        attendees_by_role: [],
        blueprint_completion: {
            average_percent: 0,
            total_with_blueprint: 0,
            distribution: [],
        },
        clinical_funnel: {
            period_label: '',
            stages: [],
        },
        activity_summary: {
            total_this_month: 0,
            last_contact_date: null,
            by_type: [],
        },
    };
}
