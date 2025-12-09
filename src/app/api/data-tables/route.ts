import { NextRequest, NextResponse } from 'next/server';
import {
    getDataTablesByClient,
    createDataTable,
    getColumnsByTable,
    getRowsByTable,
} from '@/lib/mock-data';

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

        const tables = getDataTablesByClient(clientId);

        // Optionally include columns and row counts
        const tablesWithMeta = tables.map(table => ({
            ...table,
            columns: getColumnsByTable(table.id),
            row_count: getRowsByTable(table.id).length,
        }));

        return NextResponse.json({ tables: tablesWithMeta });
    } catch (error) {
        console.error('Error fetching data tables:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { client_id, name, template_id } = body;

        if (!client_id) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        if (!name && !template_id) {
            return NextResponse.json(
                { error: 'name or template_id is required' },
                { status: 400 }
            );
        }

        const table = createDataTable(client_id, name, template_id);
        const columns = getColumnsByTable(table.id);

        return NextResponse.json({
            table: {
                ...table,
                columns,
                row_count: 0,
            }
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating data table:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
