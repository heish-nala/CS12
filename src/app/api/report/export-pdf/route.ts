import { NextRequest, NextResponse } from 'next/server';
import { requireOrgDsoAccess } from '@/lib/auth';
import type { ReportData, ReportNarratives } from '@/lib/db/types';
import { buildReportHtml } from '@/lib/report-html-builder';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { reportData, narratives } = body as {
            reportData: ReportData;
            narratives: ReportNarratives;
        };

        if (!reportData || !narratives) {
            return NextResponse.json({ error: 'reportData and narratives are required' }, { status: 400 });
        }

        // Auth check using clientId from reportData
        const clientId = reportData.dso.id;
        const accessResult = await requireOrgDsoAccess(request, clientId, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        // Build the filled HTML report
        const html = buildReportHtml(reportData, narratives);

        // Return HTML — the browser will open it and trigger print-to-PDF
        // NOTE: For server-side PDF generation, swap this for a PDF API call
        // (e.g. DocRaptor, Puppeteer microservice, etc.)
        return new NextResponse(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `attachment; filename="${reportData.dso.name.replace(/\s+/g, '-')}-Report.html"`,
            },
        });
    } catch (error) {
        console.error('Error exporting report:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 },
        );
    }
}
