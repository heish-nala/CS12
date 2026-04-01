import { NextRequest, NextResponse } from 'next/server';
import { requireOrgDsoAccess } from '@/lib/auth';
import { generateReportData } from '@/lib/report-engine';
import { draftNarratives } from '@/lib/report-narratives';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clientId, periodStart, periodEnd } = body;

        if (!clientId || !periodStart || !periodEnd) {
            return NextResponse.json(
                { error: 'clientId, periodStart, and periodEnd are required' },
                { status: 400 },
            );
        }

        // Auth check
        const accessResult = await requireOrgDsoAccess(request, clientId, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        // Pull structured data
        const reportData = await generateReportData(clientId, periodStart, periodEnd);

        // Draft narratives via Claude
        const narratives = await draftNarratives(reportData);

        return NextResponse.json({ reportData, narratives });
    } catch (error) {
        console.error('Error generating report data:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 },
        );
    }
}
