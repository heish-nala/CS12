import { NextRequest, NextResponse } from 'next/server';
import {
    getOverviewWidgetsByClient,
    createOverviewWidget,
    getDataTablesByClient,
    getColumnsByTable,
    calculateAggregation,
    calculateChartData,
    getAggregatableColumns,
    getChartableColumns,
} from '@/lib/mock-data';
import { OverviewMetricCard, OverviewChartWidget } from '@/lib/db/types';
import { requireAuth, checkDsoAccess } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Require authentication
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const currentUser = authResult.user;

        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('client_id');

        if (!clientId) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        // Verify user has access to this client/DSO
        const { hasAccess } = await checkDsoAccess(currentUser.id, clientId);
        if (!hasAccess) {
            return NextResponse.json(
                { error: 'Access denied to this workspace' },
                { status: 403 }
            );
        }

        const widgets = getOverviewWidgetsByClient(clientId);

        // Calculate values for each widget
        const widgetsWithValues = widgets.map(widget => {
            if (widget.type === 'metric_card') {
                const config = widget.config as OverviewMetricCard['config'];
                const computed_value = calculateAggregation(
                    config.table_id,
                    config.column_id,
                    config.aggregation
                );
                return { ...widget, computed_value };
            } else if (widget.type === 'chart') {
                const config = widget.config as OverviewChartWidget['config'];
                const computed_data = calculateChartData(
                    config.table_id,
                    config.column_id
                );
                return { ...widget, computed_data };
            }
            return widget;
        });

        return NextResponse.json({ widgets: widgetsWithValues });
    } catch (error) {
        console.error('Error fetching overview widgets:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        // Require authentication
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const currentUser = authResult.user;

        const body = await request.json();
        const { client_id, type, label, config } = body;

        if (!client_id) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        // Verify user has write access to this client/DSO
        const { hasAccess, role } = await checkDsoAccess(currentUser.id, client_id);
        if (!hasAccess || (role !== 'admin' && role !== 'manager')) {
            return NextResponse.json(
                { error: 'Write access required to create widgets' },
                { status: 403 }
            );
        }

        if (!type || !['metric_card', 'chart'].includes(type)) {
            return NextResponse.json(
                { error: 'type must be "metric_card" or "chart"' },
                { status: 400 }
            );
        }

        if (!label) {
            return NextResponse.json(
                { error: 'label is required' },
                { status: 400 }
            );
        }

        if (!config || !config.table_id || !config.column_id) {
            return NextResponse.json(
                { error: 'config with table_id and column_id is required' },
                { status: 400 }
            );
        }

        if (type === 'metric_card' && !config.aggregation) {
            return NextResponse.json(
                { error: 'aggregation is required for metric_card' },
                { status: 400 }
            );
        }

        if (type === 'chart' && !config.chart_type) {
            return NextResponse.json(
                { error: 'chart_type is required for chart widget' },
                { status: 400 }
            );
        }

        const widget = createOverviewWidget(client_id, type, label, config);

        // Calculate value for the new widget
        if (widget.type === 'metric_card') {
            const widgetConfig = widget.config as OverviewMetricCard['config'];
            const computed_value = calculateAggregation(
                widgetConfig.table_id,
                widgetConfig.column_id,
                widgetConfig.aggregation
            );
            return NextResponse.json({ widget: { ...widget, computed_value } }, { status: 201 });
        } else {
            const widgetConfig = widget.config as OverviewChartWidget['config'];
            const computed_data = calculateChartData(
                widgetConfig.table_id,
                widgetConfig.column_id
            );
            return NextResponse.json({ widget: { ...widget, computed_data } }, { status: 201 });
        }
    } catch (error) {
        console.error('Error creating overview widget:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
