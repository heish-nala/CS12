import { NextResponse } from 'next/server';
import { getTemplates } from '@/lib/mock-data';

export async function GET() {
    try {
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
