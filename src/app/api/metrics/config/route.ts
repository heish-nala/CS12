import { NextRequest, NextResponse } from 'next/server';
import { MetricConfig } from '@/lib/db/types';

// Mock in-memory storage (in production, this would be in Supabase)
// Format: { [clientId: string]: MetricConfig[] }
const mockConfigs: Record<string, MetricConfig[]> = {};

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const clientId = searchParams.get('client_id');

        if (!clientId) {
            return NextResponse.json(
                { error: 'client_id parameter is required' },
                { status: 400 }
            );
        }

        // Get config for this client, or return empty array if none exists
        const config = mockConfigs[clientId] || [];

        return NextResponse.json({ configs: config });
    } catch (error) {
        console.error('Error fetching metric config:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { client_id, configs } = body;

        if (!client_id) {
            return NextResponse.json(
                { error: 'client_id is required' },
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
        mockConfigs[client_id] = configs.map((config, index) => ({
            id: config.id || `${client_id}_${config.metric_id}`,
            client_id,
            metric_id: config.metric_id,
            enabled: config.enabled,
            order_index: config.order_index,
            created_at: config.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        return NextResponse.json({
            success: true,
            configs: mockConfigs[client_id]
        });
    } catch (error) {
        console.error('Error saving metric config:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
