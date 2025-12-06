import { NextRequest, NextResponse } from 'next/server';
import { getPeriodProgressByDoctor } from '@/lib/mock-data';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const periods = getPeriodProgressByDoctor(id);

        // Sort by period number
        periods.sort((a, b) => a.period_number - b.period_number);

        return NextResponse.json(periods);
    } catch (error) {
        console.error('Error fetching period progress:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH disabled for mock data mode
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    return NextResponse.json(
        { error: 'Updating period progress is disabled in mock data mode' },
        { status: 503 }
    );
}
