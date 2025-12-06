import { NextRequest, NextResponse } from 'next/server';
import {
    updateDataColumn,
    deleteDataColumn,
    mockDataColumns
} from '@/lib/mock-data';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; columnId: string }> }
) {
    try {
        const { columnId } = await params;
        const body = await request.json();

        const column = updateDataColumn(columnId, body);

        if (!column) {
            return NextResponse.json(
                { error: 'Column not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ column });
    } catch (error) {
        console.error('Error updating column:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; columnId: string }> }
) {
    try {
        const { columnId } = await params;
        const deleted = deleteDataColumn(columnId);

        if (!deleted) {
            return NextResponse.json(
                { error: 'Column not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting column:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
