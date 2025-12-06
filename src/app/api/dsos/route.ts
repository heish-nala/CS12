import { NextRequest, NextResponse } from 'next/server';
import { mockDSOs } from '@/lib/mock-data';

export async function GET() {
    try {
        // Sort DSOs by name
        const sortedDSOs = [...mockDSOs].sort((a, b) => a.name.localeCompare(b.name));
        return NextResponse.json({ dsos: sortedDSOs });
    } catch (error) {
        console.error('Error fetching DSOs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST disabled for mock data mode
export async function POST(request: NextRequest) {
    return NextResponse.json(
        { error: 'Creating DSOs is disabled in mock data mode' },
        { status: 503 }
    );
}
