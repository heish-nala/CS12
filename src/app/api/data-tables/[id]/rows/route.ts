import { NextRequest, NextResponse } from 'next/server';
import {
    getRowsByTable,
    createDataRow,
    getDataTableById,
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

        const rows = getRowsByTable(id);
        return NextResponse.json({ rows });
    } catch (error) {
        console.error('Error fetching rows:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { data } = body;

        const table = getDataTableById(id);
        if (!table) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        const row = createDataRow(id, data || {});
        return NextResponse.json({ row }, { status: 201 });
    } catch (error) {
        console.error('Error creating row:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
