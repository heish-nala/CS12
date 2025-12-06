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
import { GripVertical } from 'lucide-react';

export interface MetricConfig {
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    order: number;
}

const MAX_METRICS = 5;

export const DEFAULT_METRICS: MetricConfig[] = [
    {
        id: 'total_doctors',
        label: 'Total Doctors',
        description: 'Total number of doctors',
        enabled: true,
        order: 0,
    },
    {
        id: 'active_doctors',
        label: 'Active Doctors',
        description: 'Number of active doctors',
        enabled: false,
        order: 1,
    },
    {
        id: 'engagement_rate',
        label: 'Engagement Rate',
        description: 'Engagement percentage (last 7 days)',
        enabled: true,
        order: 2,
    },
    {
        id: 'at_risk_count',
        label: 'At Risk Count',
        description: 'Number of doctors at risk',
        enabled: true,
        order: 3,
    },
    {
        id: 'total_cases',
        label: 'Total Cases',
        description: 'Total number of cases',
        enabled: true,
        order: 4,
    },
    {
        id: 'avg_course_progress',
        label: 'Average Course Progress',
        description: 'Average course completion percentage',
        enabled: true,
        order: 5,
    },
];

interface CardConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    metrics: MetricConfig[];
    onSave: (metrics: MetricConfig[]) => void;
}

export function CardConfigDialog({
    open,
    onOpenChange,
    metrics,
    onSave,
}: CardConfigDialogProps) {
    const [localMetrics, setLocalMetrics] = useState<MetricConfig[]>(metrics);

    const enabledCount = localMetrics.filter(m => m.enabled).length;

    // Sync local state when dialog opens or metrics prop changes
    useEffect(() => {
        if (open) {
            setLocalMetrics(metrics);
        }
    }, [open, metrics]);

    const handleToggle = (metricId: string, currentlyEnabled: boolean) => {
        // If trying to enable and already at max, don't allow
        if (!currentlyEnabled && enabledCount >= MAX_METRICS) {
            return;
        }

        setLocalMetrics(prev =>
            prev.map(m =>
                m.id === metricId ? { ...m, enabled: !m.enabled } : m
            )
        );
    };

    const handleSave = () => {
        onSave(localMetrics);
        onOpenChange(false);
    };

    const handleClearSelection = () => {
        setLocalMetrics(prev => prev.map(m => ({ ...m, enabled: false })));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Customize Card Metrics</DialogTitle>
                    <DialogDescription>
                        Choose which metrics to display on your client cards (max {MAX_METRICS})
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 p-4 pt-4">
                    <div className="flex items-center justify-between px-1 py-2 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">
                            Selected Metrics
                        </span>
                        <span className={`text-sm font-semibold ${enabledCount >= MAX_METRICS ? 'text-orange-600' : 'text-muted-foreground'}`}>
                            {enabledCount} / {MAX_METRICS}
                        </span>
                    </div>

                    <div className="grid gap-3">
                        {localMetrics.map((metric) => {
                            const isDisabled = !metric.enabled && enabledCount >= MAX_METRICS;
                            return (
                                <div
                                    key={metric.id}
                                    onClick={() => !isDisabled && handleToggle(metric.id, metric.enabled)}
                                    className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all ${
                                        metric.enabled
                                            ? 'border-primary bg-primary/5 shadow-sm'
                                            : 'border-border bg-background'
                                    } ${
                                        isDisabled
                                            ? 'opacity-40 cursor-not-allowed grayscale'
                                            : 'cursor-pointer hover:border-primary/50 hover:bg-accent/30'
                                    }`}
                                >
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">
                                            {metric.label}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {metric.description}
                                        </p>
                                    </div>
                                    {metric.enabled && (
                                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                            <svg
                                                className="h-3 w-3 text-primary-foreground"
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {enabledCount >= MAX_METRICS && (
                        <p className="text-xs text-orange-600 font-medium">
                            Maximum of {MAX_METRICS} metrics reached. Deselect a metric to choose another.
                        </p>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClearSelection}>
                        Clear Selection
                    </Button>
                    <Button onClick={handleSave}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
