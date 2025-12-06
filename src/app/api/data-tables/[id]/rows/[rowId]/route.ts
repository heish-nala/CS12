import { NextRequest, NextResponse } from 'next/server';
import {
    updateDataRow,
    deleteDataRow,
    mockDataRows
} from '@/lib/mock-data';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    try {
        const { rowId } = await params;
        const body = await request.json();
        const { data } = body;

        const row = updateDataRow(rowId, data || {});

        if (!row) {
            return NextResponse.json(
                { error: 'Row not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ row });
    } catch (error) {
        console.error('Error updating row:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    try {
        const { rowId } = await params;
        const deleted = deleteDataRow(rowId);

        if (!deleted) {
            return NextResponse.json(
                { error: 'Row not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting row:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
