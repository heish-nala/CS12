import { NextRequest, NextResponse } from 'next/server';
import {
    getDataTablesByClient,
    getAggregatableColumns,
    getChartableColumns,
} from '@/lib/mock-data';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('client_id');
        const type = searchParams.get('type') || 'all'; // 'aggregatable', 'chartable', or 'all'

        if (!clientId) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        const tables = getDataTablesByClient(clientId);

        // Build response with columns grouped by table
        const result = tables.map(table => {
            let columns: ReturnType<typeof getAggregatableColumns> = [];

            if (type === 'aggregatable') {
                columns = getAggregatableColumns(table.id);
            } else if (type === 'chartable') {
                columns = getChartableColumns(table.id);
            } else {
                // Return both types
                const aggregatable = getAggregatableColumns(table.id);
                const chartable = getChartableColumns(table.id);
                columns = [...aggregatable, ...chartable];
            }

            return {
                table_id: table.id,
                table_name: table.name,
                table_icon: table.icon,
                table_color: table.color,
                columns: columns.map(col => ({
                    id: col.id,
                    name: col.name,
                    type: col.type,
                    config: col.config,
                })),
            };
        }).filter(t => t.columns.length > 0);

        return NextResponse.json({ tables: result });
    } catch (error) {
        console.error('Error fetching widget columns:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
