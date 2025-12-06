'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DashboardMetrics, OverviewWidget, OverviewWidgetWithValue, OverviewChartWidgetWithData } from '@/lib/db/types';
import { Activity, TrendingUp, Users, AlertTriangle, Clock, Target, MessageSquare, CheckCircle2, Zap, FileText, GraduationCap, Settings2, Plus, ArrowRight, Hash, BarChart3 } from 'lucide-react';
import { OverviewConfigDialog } from './overview-config-dialog';
import { toast } from 'sonner';

interface ExecutiveDashboardProps {
    dsoId?: string;
}

type WidgetWithValue = OverviewWidgetWithValue | OverviewChartWidgetWithData;

export function ExecutiveDashboard({ dsoId }: ExecutiveDashboardProps = {}) {
    const [loading, setLoading] = useState(true);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [widgets, setWidgets] = useState<WidgetWithValue[]>([]);

    const fetchWidgets = useCallback(async () => {
        if (!dsoId) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/overview-widgets?client_id=${dsoId}`);
            const data = await response.json();
            setWidgets(data.widgets || []);
        } catch (error) {
            console.error('Error fetching widgets:', error);
        } finally {
            setLoading(false);
        }
    }, [dsoId]);

    useEffect(() => {
        fetchWidgets();
    }, [fetchWidgets]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(8)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="h-64 bg-muted animate-pulse rounded" />
                    ))}
                </div>
            </div>
        );
    }

    // Helper to format values based on column type
    const formatValue = (value: number | null, format?: string, prefix?: string, suffix?: string) => {
        if (value === null) return '-';

        let formatted: string;
        if (format === 'currency') {
            formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
        } else if (format === 'percentage') {
            formatted = `${value}%`;
        } else {
            formatted = value.toLocaleString();
        }

        return `${prefix || ''}${formatted}${suffix || ''}`;
    };

    // Render a metric card widget
    const renderMetricCardWidget = (widget: OverviewWidgetWithValue) => {
        const config = widget.config;
        return (
            <Card key={widget.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{widget.label}</CardTitle>
                    <Hash className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatValue(widget.computed_value, config.format, config.prefix, config.suffix)}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                        {config.aggregation}
                    </p>
                </CardContent>
            </Card>
        );
    };

    // Color mapping for chart segments
    const getChartColor = (colorName?: string) => {
        const colorMap: Record<string, string> = {
            gray: '#6b7280',
            red: '#ef4444',
            orange: '#f97316',
            yellow: '#eab308',
            green: '#22c55e',
            blue: '#3b82f6',
            purple: '#a855f7',
            pink: '#ec4899',
        };
        return colorMap[colorName || 'blue'] || colorMap.blue;
    };

    // Render a chart widget with simple bar visualization
    const renderChartWidget = (widget: OverviewChartWidgetWithData) => {
        const data = widget.computed_data || [];
        const maxValue = Math.max(...data.map(d => d.value), 1);

        return (
            <Card key={widget.id} className="col-span-1 md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{widget.label}</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {data.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No data available</p>
                        ) : (
                            data.map((item, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <Badge
                                        variant="outline"
                                        className="min-w-[80px] justify-center"
                                        style={{
                                            backgroundColor: `${getChartColor(item.color)}15`,
                                            borderColor: `${getChartColor(item.color)}40`,
                                            color: getChartColor(item.color),
                                        }}
                                    >
                                        {item.label}
                                    </Badge>
                                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${(item.value / maxValue) * 100}%`,
                                                backgroundColor: getChartColor(item.color),
                                            }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium min-w-[40px] text-right">
                                        {item.value}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Separate metric cards and charts
    const metricCards = widgets.filter(w => w.type === 'metric_card') as OverviewWidgetWithValue[];
    const chartWidgets = widgets.filter(w => w.type === 'chart') as OverviewChartWidgetWithData[];

    return (
        <div className="space-y-6">
            {/* Header with Settings Button */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
                    <p className="text-muted-foreground">
                        Key metrics from your data tables
                    </p>
                </div>
                {dsoId && (
                    <Button variant="outline" size="sm" onClick={() => setConfigDialogOpen(true)}>
                        <Settings2 className="h-4 w-4 mr-2" />
                        Configure Widgets
                    </Button>
                )}
            </div>

            {/* Empty State */}
            {widgets.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="rounded-full bg-muted p-6 mb-6">
                            <BarChart3 className="h-12 w-12 text-muted-foreground" />
                        </div>

                        <h3 className="text-xl font-semibold mb-2">No Widgets Configured</h3>
                        <p className="text-muted-foreground text-center max-w-md mb-8">
                            Add metric cards and charts to display aggregated data from your tables on this overview page.
                        </p>

                        <Button size="lg" onClick={() => setConfigDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Your First Widget
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Metric Cards */}
            {metricCards.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-4">Metrics</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {metricCards.map(widget => renderMetricCardWidget(widget))}
                    </div>
                </div>
            )}

            {/* Chart Widgets */}
            {chartWidgets.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-4">Charts</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {chartWidgets.map(widget => renderChartWidget(widget))}
                    </div>
                </div>
            )}

            {/* Overview Configuration Dialog */}
            {dsoId && (
                <OverviewConfigDialog
                    open={configDialogOpen}
                    onOpenChange={setConfigDialogOpen}
                    clientId={dsoId}
                    widgets={widgets}
                    onWidgetsChange={fetchWidgets}
                />
            )}
        </div>
    );
}
