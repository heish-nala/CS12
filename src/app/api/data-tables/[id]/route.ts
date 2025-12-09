import { NextRequest, NextResponse } from 'next/server';
import {
    getDataTableById,
    getColumnsByTable,
    getRowsByTable,
    deleteDataTable,
    mockDataTables,
    clearPeriodsForTable,
} from '@/lib/mock-data';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const table = getDataTableById(id);

        if (!table) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        const columns = getColumnsByTable(id);
        const rows = getRowsByTable(id);

        return NextResponse.json({
            table: {
                ...table,
                columns,
                rows,
            }
        });
    } catch (error) {
        console.error('Error fetching data table:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const tableIndex = mockDataTables.findIndex(t => t.id === id);

        if (tableIndex === -1) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        const currentTable = mockDataTables[tableIndex];
        const currentFrequency = currentTable.time_tracking?.frequency;
        const newFrequency = body.time_tracking?.frequency;

        console.log(`[TABLE PUT] id=${id}, currentFrequency=${currentFrequency}, newFrequency=${newFrequency}`);

        // If frequency is changing, clear all existing periods so they get regenerated
        if (currentFrequency && newFrequency && currentFrequency !== newFrequency) {
            console.log(`[TABLE PUT] Clearing periods for table ${id}`);
            clearPeriodsForTable(id);
        }

        mockDataTables[tableIndex] = {
            ...mockDataTables[tableIndex],
            ...body,
            updated_at: new Date().toISOString(),
        };

        return NextResponse.json({ table: mockDataTables[tableIndex] });
    } catch (error) {
        console.error('Error updating data table:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const deleted = deleteDataTable(id);

        if (!deleted) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting data table:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
