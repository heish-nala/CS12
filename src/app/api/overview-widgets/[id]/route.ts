import { NextRequest, NextResponse } from 'next/server';
import {
    getOverviewWidgetById,
    updateOverviewWidget,
    deleteOverviewWidget,
    calculateAggregation,
    calculateChartData,
} from '@/lib/mock-data';
import { OverviewMetricCard, OverviewChartWidget } from '@/lib/db/types';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const widget = getOverviewWidgetById(id);

        if (!widget) {
            return NextResponse.json(
                { error: 'Widget not found' },
                { status: 404 }
            );
        }

        // Calculate value
        if (widget.type === 'metric_card') {
            const config = widget.config as OverviewMetricCard['config'];
            const computed_value = calculateAggregation(
                config.table_id,
                config.column_id,
                config.aggregation
            );
            return NextResponse.json({ widget: { ...widget, computed_value } });
        } else {
            const config = widget.config as OverviewChartWidget['config'];
            const computed_data = calculateChartData(
                config.table_id,
                config.column_id
            );
            return NextResponse.json({ widget: { ...widget, computed_data } });
        }
    } catch (error) {
        console.error('Error fetching widget:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { label, order_index, config } = body;

        const widget = updateOverviewWidget(id, { label, order_index, config });

        if (!widget) {
            return NextResponse.json(
                { error: 'Widget not found' },
                { status: 404 }
            );
        }

        // Calculate value
        if (widget.type === 'metric_card') {
            const widgetConfig = widget.config as OverviewMetricCard['config'];
            const computed_value = calculateAggregation(
                widgetConfig.table_id,
                widgetConfig.column_id,
                widgetConfig.aggregation
            );
            return NextResponse.json({ widget: { ...widget, computed_value } });
        } else {
            const widgetConfig = widget.config as OverviewChartWidget['config'];
            const computed_data = calculateChartData(
                widgetConfig.table_id,
                widgetConfig.column_id
            );
            return NextResponse.json({ widget: { ...widget, computed_data } });
        }
    } catch (error) {
        console.error('Error updating widget:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const success = deleteOverviewWidget(id);

        if (!success) {
            return NextResponse.json(
                { error: 'Widget not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting widget:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
