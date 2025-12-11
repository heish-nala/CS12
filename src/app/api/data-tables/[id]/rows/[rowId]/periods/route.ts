import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

// Helper to initialize periods for a row
async function initializePeriodsForRow(
    tableId: string,
    rowId: string,
    frequency: 'weekly' | 'monthly' | 'quarterly',
    metrics: Array<{ id: string; name: string; type: string }>
) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const periodsToInsert: any[] = [];

    if (frequency === 'monthly') {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];

        for (let month = 0; month < 12; month++) {
            const startDate = new Date(currentYear, month, 1);
            const endDate = new Date(currentYear, month + 1, 0);

            const metricsData: Record<string, number> = {};
            metrics?.forEach(metric => {
                metricsData[metric.id] = 0;
            });

            periodsToInsert.push({
                table_id: tableId,
                row_id: rowId,
                period_start: startDate.toISOString().split('T')[0],
                period_end: endDate.toISOString().split('T')[0],
                period_label: monthNames[month],
                metrics: metricsData,
            });
        }
    } else if (frequency === 'weekly') {
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let week = 1; week <= 52; week++) {
            const startDate = getWeekStartDate(currentYear, week);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);

            const startMonth = shortMonths[startDate.getMonth()];
            const endMonth = shortMonths[endDate.getMonth()];
            const startDay = startDate.getDate();
            const endDay = endDate.getDate();

            let label: string;
            if (startMonth === endMonth) {
                label = `${startMonth} ${startDay}-${endDay}`;
            } else {
                label = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
            }

            const metricsData: Record<string, number> = {};
            metrics?.forEach(metric => {
                metricsData[metric.id] = 0;
            });

            periodsToInsert.push({
                table_id: tableId,
                row_id: rowId,
                period_start: startDate.toISOString().split('T')[0],
                period_end: endDate.toISOString().split('T')[0],
                period_label: label,
                metrics: metricsData,
            });
        }
    } else if (frequency === 'quarterly') {
        const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];
        for (let q = 0; q < 4; q++) {
            const startMonth = q * 3;
            const startDate = new Date(currentYear, startMonth, 1);
            const endDate = new Date(currentYear, startMonth + 3, 0);

            const metricsData: Record<string, number> = {};
            metrics?.forEach(metric => {
                metricsData[metric.id] = 0;
            });

            periodsToInsert.push({
                table_id: tableId,
                row_id: rowId,
                period_start: startDate.toISOString().split('T')[0],
                period_end: endDate.toISOString().split('T')[0],
                period_label: `${quarterNames[q]} ${currentYear}`,
                metrics: metricsData,
            });
        }
    }

    if (periodsToInsert.length > 0) {
        const { data: periods, error } = await supabaseAdmin
            .from('period_data')
            .insert(periodsToInsert)
            .select();

        if (error) {
            console.error('Error initializing periods:', error);
            return [];
        }
        return periods || [];
    }

    return [];
}

function getWeekStartDate(year: number, week: number): Date {
    const jan1 = new Date(year, 0, 1);
    const daysOffset = (week - 1) * 7;
    const dayOfWeek = jan1.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);

    const result = new Date(year, 0, 1 + daysToMonday + daysOffset);
    return result;
}

// GET /api/data-tables/[id]/rows/[rowId]/periods - Get all periods for a row
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    const { id: tableId, rowId } = await params;

    // Verify table exists and get time tracking config
    const { data: table, error: tableError } = await supabaseAdmin
        .from('data_tables')
        .select('id, time_tracking')
        .eq('id', tableId)
        .single();

    if (tableError || !table) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Fetch existing periods
    let { data: periods, error: periodsError } = await supabaseAdmin
        .from('period_data')
        .select('*')
        .eq('table_id', tableId)
        .eq('row_id', rowId)
        .order('period_start');

    if (periodsError) {
        // Table might not exist yet - return empty array
        console.log('Period data table may not exist:', periodsError.message);
        return NextResponse.json([]);
    }

    // If no periods exist and time tracking is enabled, initialize them
    if ((!periods || periods.length === 0) && table.time_tracking?.enabled) {
        periods = await initializePeriodsForRow(
            tableId,
            rowId,
            table.time_tracking.frequency,
            table.time_tracking.metrics || []
        );
    }

    return NextResponse.json(periods || []);
}
