import { NextRequest, NextResponse } from 'next/server';
import { getTemplates } from '@/lib/mock-data';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) return authResult.response;

        const templates = getTemplates();
        return NextResponse.json({ templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
