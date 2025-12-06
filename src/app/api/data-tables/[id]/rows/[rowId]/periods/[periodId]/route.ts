import { NextRequest, NextResponse } from 'next/server';
import {
    getPeriodDataById,
    updatePeriodData,
    deletePeriodData,
} from '@/lib/mock-data';

// GET /api/data-tables/[id]/rows/[rowId]/periods/[periodId] - Get a specific period
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string; periodId: string }> }
) {
    const { periodId } = await params;

    const period = getPeriodDataById(periodId);
    if (!period) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    return NextResponse.json(period);
}

// PUT /api/data-tables/[id]/rows/[rowId]/periods/[periodId] - Update period metrics
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string; periodId: string }> }
) {
    const { periodId } = await params;
    const body = await request.json();

    const { metrics } = body;
    if (!metrics || typeof metrics !== 'object') {
        return NextResponse.json({ error: 'Metrics object required' }, { status: 400 });
    }

    const updated = updatePeriodData(periodId, metrics);
    if (!updated) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
}

// DELETE /api/data-tables/[id]/rows/[rowId]/periods/[periodId] - Delete a period
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string; periodId: string }> }
) {
    const { periodId } = await params;

    const success = deletePeriodData(periodId);
    if (!success) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
