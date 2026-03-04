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

// Old metric IDs that need migration
const LEGACY_METRIC_IDS = ['total_doctors', 'active_doctors', 'engagement_rate', 'at_risk_count', 'total_cases', 'avg_course_progress'];

export const DEFAULT_METRICS: MetricConfig[] = [
    {
        id: 'total_attendees',
        label: 'Attendees',
        description: 'Total attendees across all trackers',
        enabled: true,
        order: 0,
    },
    {
        id: 'active_attendees',
        label: 'Active',
        description: 'Number of active attendees',
        enabled: false,
        order: 1,
    },
    {
        id: 'avg_blueprint',
        label: 'Blueprint',
        description: 'Average Blueprint completion percentage',
        enabled: true,
        order: 2,
    },
    {
        id: 'needs_attention',
        label: 'Needs Attention',
        description: 'Attendees with high Blueprint but no recent accepted cases',
        enabled: true,
        order: 3,
    },
    {
        id: 'accepted',
        label: 'Accepted',
        description: 'Accepted cases this period',
        enabled: true,
        order: 4,
    },
    {
        id: 'clinical_summary',
        label: 'Clinical Summary',
        description: 'Diagnosed and scans this period',
        enabled: true,
        order: 5,
    },
];

/**
 * Migrate legacy metric configs to new IDs.
 * If stored config has any old IDs, clear and reset to defaults.
 */
export function migrateMetricsConfig(): MetricConfig[] | null {
    try {
        const stored = localStorage.getItem('client_card_metrics');
        if (!stored) return null;
        const parsed: MetricConfig[] = JSON.parse(stored);
        const hasLegacy = parsed.some(m => LEGACY_METRIC_IDS.includes(m.id));
        if (hasLegacy) {
            localStorage.removeItem('client_card_metrics');
            return DEFAULT_METRICS;
        }
        return parsed;
    } catch {
        return null;
    }
}

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
