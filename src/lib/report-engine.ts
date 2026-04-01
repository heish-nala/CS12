import { supabaseAdmin } from '@/lib/db/client';
import { findAttendeeTables, getStatusOptions } from '@/lib/attendee-tracker';
import type { ReportData, ReportDoctorRow, ReportQuote, ReportSentimentRow } from '@/lib/db/types';

export type { ReportData };

/**
 * Pull all data needed to generate a performance report for a DSO.
 * @param clientId  The DSO's client ID
 * @param periodStart  ISO date string (e.g. "2026-01-22")
 * @param periodEnd    ISO date string (e.g. "2026-03-19")
 */
export async function generateReportData(
    clientId: string,
    periodStart: string,
    periodEnd: string,
): Promise<ReportData> {
    // 1. Fetch client/DSO details
    const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
    if (clientError) throw clientError;

    // 2. Get attendee tracker tables (doctor roster)
    const { tables: attendeeTables } = await findAttendeeTables(clientId);

    // 3. Build doctor name → row map from attendee tracker
    const doctorRows: Array<{
        name: string;
        rowId: string;
        tableId: string;
        blueprintPct: number | null;
        status: string;
    }> = [];

    const attendeeTableIds: string[] = [];

    for (const at of attendeeTables) {
        attendeeTableIds.push(at.tableId);
        const statusOptions = getStatusOptions(at.statusCol);
        // Find the name column (primary or first text column)
        const nameCol = at.columns.find((c: any) => c.is_primary) ||
            at.columns.find((c: any) => c.type === 'text' && c.name.toLowerCase().includes('name')) ||
            at.columns.find((c: any) => c.type === 'text');

        for (const row of at.rows) {
            const name = nameCol ? String(row.data?.[nameCol.id] || '') : '';
            if (!name) continue;

            const bpRaw = row.data?.[at.blueprintCol.id];
            const blueprintPct = bpRaw !== null && bpRaw !== undefined && bpRaw !== '' ? Number(bpRaw) : null;

            const statusVal = row.data?.[at.statusCol.id];
            const statusLabel = statusVal ? (statusOptions[statusVal]?.label || statusVal) : '';

            doctorRows.push({
                name,
                rowId: row.id,
                tableId: at.tableId,
                blueprintPct,
                status: statusLabel,
            });
        }
    }

    // 4. Pull period_data for the date range
    const { data: periodDataRows } = await supabaseAdmin
        .from('period_data')
        .select('*')
        .in('table_id', attendeeTableIds)
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd);

    // Build metric ID → name map from table time_tracking configs
    const metricIdToName: Record<string, string> = {};
    for (const at of attendeeTables) {
        if (at.table.time_tracking?.metrics) {
            for (const m of at.table.time_tracking.metrics) {
                metricIdToName[m.id] = m.name.toLowerCase().replace(/\s+/g, '-');
            }
        }
    }

    // Aggregate period_data per doctor row
    const rowMetrics: Record<string, Record<string, number>> = {};
    for (const pd of (periodDataRows || [])) {
        if (!pd.row_id || !pd.metrics) continue;
        if (!rowMetrics[pd.row_id]) rowMetrics[pd.row_id] = {};
        for (const [metricId, value] of Object.entries(pd.metrics as Record<string, any>)) {
            const name = metricIdToName[metricId] || metricId;
            rowMetrics[pd.row_id][name] = (rowMetrics[pd.row_id][name] || 0) + (Number(value) || 0);
        }
    }

    // Aggregate totals
    const totalStats = { scans: 0, diagnosed: 0, accepted: 0 };
    for (const metrics of Object.values(rowMetrics)) {
        // Try both kebab and plain names
        totalStats.scans += metrics['metric-scans'] || metrics['scans'] || 0;
        totalStats.diagnosed += metrics['metric-diagnosed'] || metrics['diagnosed'] || 0;
        totalStats.accepted += metrics['metric-accepted'] || metrics['accepted'] || 0;
    }

    // 5. Pull activities for the date range
    const { data: activities } = await supabaseAdmin
        .from('activities')
        .select('*')
        .eq('client_id', clientId)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd + 'T23:59:59Z')
        .order('created_at', { ascending: false });

    // Count calls per doctor contact_name
    const callsPerDoctor: Record<string, number> = {};
    const doctorsContactedSet = new Set<string>();
    for (const act of (activities || [])) {
        if (act.activity_type === 'phone' && act.contact_name) {
            callsPerDoctor[act.contact_name] = (callsPerDoctor[act.contact_name] || 0) + 1;
            doctorsContactedSet.add(act.contact_name);
        }
    }

    // 6. Extract notable quotes
    const quotes: ReportQuote[] = [];
    for (const act of (activities || [])) {
        // Use explicit notable_quote if present, else skip (don't auto-extract from description)
        if (act.notable_quote && act.contact_name) {
            quotes.push({
                text: act.notable_quote,
                doctorName: act.contact_name,
                date: act.created_at.split('T')[0],
                sentiment: act.outcome || 'neutral',
            });
        }
    }

    // 7. Build sentiment summary from activities
    const sentimentSummary: ReportSentimentRow[] = [];
    const sentimentKeywords: Record<string, string> = {
        mentorship: 'Mentorship & Support',
        confidence: 'Clinical Confidence',
        'case acceptance': 'Case Acceptance',
        'office': 'Office Environment',
        'patient': 'Patient Response',
        'blueprint': 'Blueprint Curriculum',
    };

    for (const act of (activities || [])) {
        if (!act.contact_name || !act.description) continue;
        const desc = act.description.toLowerCase();
        for (const [keyword, element] of Object.entries(sentimentKeywords)) {
            if (desc.includes(keyword)) {
                sentimentSummary.push({
                    element,
                    sentiment: act.outcome || 'neutral',
                    whoSaidIt: act.contact_name,
                });
                break; // one entry per activity
            }
        }
    }

    // 8. Build final doctor rows with metrics
    const reportDoctors: ReportDoctorRow[] = doctorRows.map(dr => {
        const metrics = rowMetrics[dr.rowId] || {};
        const accepted = metrics['metric-accepted'] || metrics['accepted'] || 0;
        const scans = metrics['metric-scans'] || metrics['scans'] || 0;
        const diagnosed = metrics['metric-diagnosed'] || metrics['diagnosed'] || 0;
        const callCount = callsPerDoctor[dr.name] || 0;

        // Prior vs current activity: find latest two activities for this doctor
        const doctorActivities = (activities || []).filter(a => a.contact_name === dr.name);
        const priorActivity = doctorActivities.length > 1
            ? summarizeActivity(doctorActivities[1])
            : 'No prior activity';
        const currentActivity = doctorActivities.length > 0
            ? summarizeActivity(doctorActivities[0])
            : 'No activity logged';

        return {
            name: dr.name,
            blueprintPct: dr.blueprintPct,
            callCount,
            priorActivity,
            currentActivity,
            status: dr.status,
            accepted,
            scans,
            diagnosed,
        };
    });

    // 9. Classify doctors into finding buckets
    const confidenceParadox: string[] = [];
    const mentorshipMismatch: string[] = [];
    const structuralBarriers: string[] = [];

    const structuralKeywords = ['office move', 'relocation', 'timing', "can't start", 'patient demographic', 'moving', 'new office'];
    const mentorshipNegativeKeywords = ['mentorship', 'mentor', 'call', 'advanced'];

    for (const dr of reportDoctors) {
        // Confidence Paradox: high Blueprint but 0 accepted
        if (dr.blueprintPct !== null && dr.blueprintPct >= 80 && dr.accepted === 0) {
            confidenceParadox.push(dr.name);
        }
    }

    for (const act of (activities || [])) {
        if (!act.contact_name) continue;
        const desc = (act.description || '').toLowerCase();

        // Mentorship Mismatch: negative sentiment + mentorship keywords
        if (act.outcome === 'negative') {
            const hasMentorshipKw = mentorshipNegativeKeywords.some(kw => desc.includes(kw));
            if (hasMentorshipKw && !mentorshipMismatch.includes(act.contact_name)) {
                mentorshipMismatch.push(act.contact_name);
            }
        }

        // Structural Barriers: structural keywords in notes
        const hasStructuralKw = structuralKeywords.some(kw => desc.includes(kw));
        if (hasStructuralKw && !structuralBarriers.includes(act.contact_name)) {
            structuralBarriers.push(act.contact_name);
        }
    }

    return {
        dso: {
            id: client.id,
            name: client.name,
            leadOrtho: client.lead_ortho || '',
            doctorCount: doctorRows.length,
        },
        period: {
            start: periodStart,
            end: periodEnd,
            reportDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        },
        stats: {
            callCount: (activities || []).filter(a => a.activity_type === 'phone').length,
            doctorsContacted: doctorsContactedSet.size,
            casesAccepted: totalStats.accepted,
            scans: totalStats.scans,
            diagnosed: totalStats.diagnosed,
        },
        doctors: reportDoctors,
        quotes,
        sentimentSummary,
        doctorBuckets: {
            confidenceParadox,
            mentorshipMismatch,
            structuralBarriers,
        },
    };
}

function summarizeActivity(act: any): string {
    if (!act) return '';
    const date = new Date(act.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const typeLabel = act.activity_type === 'phone' ? 'Call' : act.activity_type === 'email' ? 'Email' : 'Text';
    const snippet = act.description?.slice(0, 80) || '';
    return `${typeLabel} on ${date}: ${snippet}${act.description?.length > 80 ? '…' : ''}`;
}
