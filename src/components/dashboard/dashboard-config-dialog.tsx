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
import { Badge } from '@/components/ui/badge';

export interface DashboardMetricConfig {
    id: string;
    label: string;
    description: string;
    category: 'overview' | 'engagement' | 'performance';
    enabled: boolean;
    order: number;
}

export const DEFAULT_DASHBOARD_METRICS: DashboardMetricConfig[] = [
    // Program Overview Section
    {
        id: 'total_doctors',
        label: 'Total Doctors',
        description: 'Total number of doctors with active/inactive count',
        category: 'overview',
        enabled: true,
        order: 0,
    },
    {
        id: 'on_track_count',
        label: 'On Track',
        description: 'Doctors meeting or exceeding targets',
        category: 'overview',
        enabled: true,
        order: 1,
    },
    {
        id: 'at_risk_count',
        label: 'At Risk',
        description: 'Doctors at risk with critical count',
        category: 'overview',
        enabled: true,
        order: 2,
    },
    {
        id: 'average_days_in_program',
        label: 'Avg. Days in Program',
        description: 'Average time doctors have been in the program',
        category: 'overview',
        enabled: true,
        order: 3,
    },
    // Engagement & Activity Section
    {
        id: 'engagement_rate',
        label: 'Engagement Rate',
        description: 'Percentage active in last 7 days',
        category: 'engagement',
        enabled: true,
        order: 4,
    },
    {
        id: 'recent_activities_count',
        label: 'Recent Activities',
        description: 'Activities logged in the last 7 days',
        category: 'engagement',
        enabled: true,
        order: 5,
    },
    {
        id: 'doctors_needing_attention',
        label: 'Needs Attention',
        description: 'Doctors with no activity in 14+ days',
        category: 'engagement',
        enabled: true,
        order: 6,
    },
    {
        id: 'completion_rate',
        label: 'Active Progress',
        description: 'Percentage making progress this period',
        category: 'engagement',
        enabled: true,
        order: 7,
    },
    // Performance Metrics Section
    {
        id: 'total_cases_this_month',
        label: 'Cases This Month',
        description: 'Cases submitted this month',
        category: 'performance',
        enabled: true,
        order: 8,
    },
    {
        id: 'total_courses_this_month',
        label: 'Courses This Month',
        description: 'Courses completed this month',
        category: 'performance',
        enabled: true,
        order: 9,
    },
    {
        id: 'avg_cases_per_doctor',
        label: 'Avg Cases/Doctor',
        description: 'All time average cases per doctor',
        category: 'performance',
        enabled: true,
        order: 10,
    },
    {
        id: 'avg_courses_per_doctor',
        label: 'Avg Courses/Doctor',
        description: 'All time average courses per doctor',
        category: 'performance',
        enabled: true,
        order: 11,
    },
];

interface DashboardConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    metrics: DashboardMetricConfig[];
    onSave: (metrics: DashboardMetricConfig[]) => void;
}

export function DashboardConfigDialog({
    open,
    onOpenChange,
    metrics,
    onSave,
}: DashboardConfigDialogProps) {
    const [localMetrics, setLocalMetrics] = useState<DashboardMetricConfig[]>(metrics);

    // Sync local state when dialog opens or metrics prop changes
    useEffect(() => {
        if (open) {
            setLocalMetrics(metrics);
        }
    }, [open, metrics]);

    const handleToggle = (metricId: string) => {
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

    const handleResetToDefaults = () => {
        setLocalMetrics(DEFAULT_DASHBOARD_METRICS);
    };

    const getCategoryMetrics = (category: DashboardMetricConfig['category']) => {
        return localMetrics.filter(m => m.category === category);
    };

    const getCategoryLabel = (category: DashboardMetricConfig['category']) => {
        switch (category) {
            case 'overview':
                return 'Program Overview';
            case 'engagement':
                return 'Engagement & Activity';
            case 'performance':
                return 'Performance Metrics';
        }
    };

    const CategorySection = ({ category }: { category: DashboardMetricConfig['category'] }) => {
        const categoryMetrics = getCategoryMetrics(category);
        const enabledCount = categoryMetrics.filter(m => m.enabled).length;

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{getCategoryLabel(category)}</h4>
                    <Badge variant="outline" className="text-xs">
                        {enabledCount} / {categoryMetrics.length}
                    </Badge>
                </div>
                <div className="grid gap-2">
                    {categoryMetrics.map((metric) => (
                        <div
                            key={metric.id}
                            onClick={() => handleToggle(metric.id)}
                            className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all cursor-pointer ${
                                metric.enabled
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-border bg-background hover:border-primary/50 hover:bg-accent/30'
                            }`}
                        >
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">
                                    {metric.label}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
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
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Customize Overview Metrics</DialogTitle>
                    <DialogDescription>
                        Choose which metrics to display on your overview dashboard. Changes are saved per client.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 p-4 pt-4">
                    <CategorySection category="overview" />
                    <CategorySection category="engagement" />
                    <CategorySection category="performance" />
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleResetToDefaults}>
                        Reset to Defaults
                    </Button>
                    <Button onClick={handleSave}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
