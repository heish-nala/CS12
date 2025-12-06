'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Sparkles, Search, Settings2 } from 'lucide-react';
import {
    METRIC_LIBRARY,
    INDUSTRY_BUNDLES,
    MetricDefinition,
    getMetricsByCategory,
} from '@/lib/metrics/metric-library';
import type { MetricConfig } from '@/contexts/metric-config-context';

interface MetricConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    currentConfig: MetricConfig[];
    onSave: (configs: MetricConfig[]) => Promise<void>;
}

export function MetricConfigDialog({
    open,
    onOpenChange,
    clientId,
    currentConfig,
    onSave,
}: MetricConfigDialogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [metricConfigs, setMetricConfigs] = useState<MetricConfig[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            // Initialize with current config
            if (currentConfig.length > 0) {
                setMetricConfigs(currentConfig);
            } else {
                // Initialize with all metrics from library
                const allMetrics = Object.values(METRIC_LIBRARY).map((metric, index) => ({
                    metric_id: metric.id,
                    enabled: metric.defaultEnabled,
                    order_index: index,
                }));
                setMetricConfigs(allMetrics);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleBundleClick = (bundleId: string) => {
        const bundle = INDUSTRY_BUNDLES[bundleId];
        if (!bundle) return;

        // Enable all metrics in the bundle
        const updated = metricConfigs.map(config => ({
            ...config,
            enabled: bundle.metrics.includes(config.metric_id),
        }));

        setMetricConfigs(updated);
        toast.success(`Applied ${bundle.name} bundle`);
    };

    const handleToggleMetric = (metricId: string) => {
        setMetricConfigs(prev =>
            prev.map(config =>
                config.metric_id === metricId
                    ? { ...config, enabled: !config.enabled }
                    : config
            )
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(metricConfigs);
            toast.success('Metric configuration saved');
            onOpenChange(false);
        } catch (error) {
            console.error('Error saving metric config:', error);
            toast.error('Failed to save metric configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        const defaultConfig = Object.values(METRIC_LIBRARY).map((metric, index) => ({
            metric_id: metric.id,
            enabled: metric.defaultEnabled,
            order_index: index,
        }));
        setMetricConfigs(defaultConfig);
        toast.info('Reset to default metrics');
    };

    const isMetricEnabled = (metricId: string): boolean => {
        const config = metricConfigs.find(c => c.metric_id === metricId);
        return config?.enabled ?? false;
    };

    const filteredMetrics = Object.values(METRIC_LIBRARY).filter(metric =>
        metric.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        metric.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const overviewMetrics = getMetricsByCategory('overview');
    const engagementMetrics = getMetricsByCategory('engagement');
    const performanceMetrics = getMetricsByCategory('performance');
    const riskMetrics = getMetricsByCategory('risk');

    const MetricCard = ({ metric }: { metric: MetricDefinition }) => {
        const isEnabled = isMetricEnabled(metric.id);
        const showsOnOverview = metric.type.includes('overview_card');
        const showsOnMemberPage = metric.type.includes('member_column');

        return (
            <Card className={`${!isEnabled ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <CardTitle className="text-base">{metric.name}</CardTitle>
                            <CardDescription className="text-sm mt-1">
                                {metric.description}
                            </CardDescription>
                        </div>
                        <Switch
                            checked={isEnabled}
                            onCheckedChange={() => handleToggleMetric(metric.id)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                            {metric.category}
                        </Badge>
                        {showsOnOverview && (
                            <Badge variant="secondary" className="text-xs">
                                Overview Card
                            </Badge>
                        )}
                        {showsOnMemberPage && (
                            <Badge variant="secondary" className="text-xs">
                                Member Column
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    const MetricSection = ({ title, metrics }: { title: string; metrics: MetricDefinition[] }) => (
        <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">{title}</h4>
            <div className="grid gap-3 md:grid-cols-2">
                {metrics.map(metric => (
                    <MetricCard key={metric.id} metric={metric} />
                ))}
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Configure Metrics</DialogTitle>
                    <DialogDescription>
                        Choose which metrics to track and display. Metrics can appear on the overview
                        dashboard and members page.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="bundles" className="w-full p-4 pt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="bundles">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Industry Bundles
                        </TabsTrigger>
                        <TabsTrigger value="custom">
                            <Settings2 className="h-4 w-4 mr-2" />
                            Custom Selection
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="bundles" className="space-y-4">
                        <div className="rounded-lg border p-4 bg-muted/50">
                            <p className="text-sm text-muted-foreground">
                                Select an industry bundle to quickly enable relevant metrics for your use case.
                                You can customize individual metrics in the Custom Selection tab.
                            </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            {Object.entries(INDUSTRY_BUNDLES).map(([key, bundle]) => (
                                <Card
                                    key={key}
                                    className="cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => handleBundleClick(key)}
                                >
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">{bundle.name}</CardTitle>
                                        <CardDescription className="text-sm">
                                            {bundle.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-normal">
                                                {bundle.metrics.length} metrics
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="custom" className="space-y-6">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search metrics..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Metric List */}
                        {searchQuery ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                {filteredMetrics.map(metric => (
                                    <MetricCard key={metric.id} metric={metric} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <MetricSection title="Overview Metrics" metrics={overviewMetrics} />
                                <MetricSection title="Engagement Metrics" metrics={engagementMetrics} />
                                <MetricSection title="Performance Metrics" metrics={performanceMetrics} />
                                <MetricSection title="Risk Metrics" metrics={riskMetrics} />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleReset}>
                        Reset to Defaults
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
