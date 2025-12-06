import { NextRequest, NextResponse } from 'next/server';
import { DashboardMetricConfig } from '@/lib/db/types';

// Mock in-memory storage (in production, this would be in Supabase)
// Format: { [dsoId: string]: DashboardMetricConfig[] }
const mockConfigs: Record<string, DashboardMetricConfig[]> = {};

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const dsoId = searchParams.get('dso_id');

        if (!dsoId) {
            return NextResponse.json(
                { error: 'dso_id parameter is required' },
                { status: 400 }
            );
        }

        // Get config for this DSO, or return empty array if none exists
        const config = mockConfigs[dsoId] || [];

        return NextResponse.json({ configs: config });
    } catch (error) {
        console.error('Error fetching dashboard config:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { dso_id, configs } = body;

        if (!dso_id) {
            return NextResponse.json(
                { error: 'dso_id is required' },
                { status: 400 }
            );
        }

        if (!Array.isArray(configs)) {
            return NextResponse.json(
                { error: 'configs must be an array' },
                { status: 400 }
            );
        }

        // Validate each config
        for (const config of configs) {
            if (!config.metric_id || typeof config.enabled !== 'boolean' || typeof config.order_index !== 'number') {
                return NextResponse.json(
                    { error: 'Invalid config format' },
                    { status: 400 }
                );
            }
        }

        // Store the configs
        mockConfigs[dso_id] = configs.map((config, index) => ({
            id: config.id || `${dso_id}_${config.metric_id}`,
            dso_id,
            metric_id: config.metric_id,
            enabled: config.enabled,
            order_index: config.order_index,
            created_at: config.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        return NextResponse.json({
            success: true,
            configs: mockConfigs[dso_id]
        });
    } catch (error) {
        console.error('Error saving dashboard config:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
