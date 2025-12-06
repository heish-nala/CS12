import { NextRequest, NextResponse } from 'next/server';
import {
    getColumnsByTable,
    createDataColumn,
    getDataTableById
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
        return NextResponse.json({ columns });
    } catch (error) {
        console.error('Error fetching columns:', error);
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
        const { name, type, config } = body;

        const table = getDataTableById(id);
        if (!table) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        if (!name) {
            return NextResponse.json(
                { error: 'name is required' },
                { status: 400 }
            );
        }

        const column = createDataColumn(id, name, type || 'text', config);
        return NextResponse.json({ column }, { status: 201 });
    } catch (error) {
        console.error('Error creating column:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
