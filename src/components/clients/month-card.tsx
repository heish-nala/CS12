'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TimeTrackingMetric, PeriodData } from '@/lib/db/types';

interface MonthCardProps {
    period: PeriodData | null;
    previousPeriod?: PeriodData | null;
    metrics: TimeTrackingMetric[];
    isEditable?: boolean;
    isCurrent?: boolean;
    onChange?: (metricId: string, value: number) => void;
}

export function MonthCard({
    period,
    previousPeriod,
    metrics,
    isEditable = false,
    isCurrent = false,
    onChange,
}: MonthCardProps) {
    const [localValues, setLocalValues] = useState<Record<string, number>>({});

    useEffect(() => {
        if (period?.metrics) {
            setLocalValues(period.metrics);
        }
    }, [period?.metrics]);

    const handleChange = (metricId: string, value: string) => {
        const numValue = parseInt(value, 10) || 0;
        setLocalValues((prev) => ({ ...prev, [metricId]: numValue }));
        onChange?.(metricId, numValue);
    };

    if (!period) return null;

    // Extract year from period_start for display (parse directly to avoid timezone issues)
    const periodYear = period.period_start.split('-')[0];
    const displayLabel = `${period.period_label} ${periodYear}`;

    return (
        <div className={`p-3 rounded-lg border ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                    {displayLabel}
                </span>
                {isCurrent && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500 text-white hover:bg-emerald-500">
                        Current
                    </Badge>
                )}
            </div>

            {/* Metrics - Compact inline */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {metrics.map((metric) => (
                    <div key={metric.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{metric.name}</span>
                        {isEditable ? (
                            <Input
                                type="number"
                                min={0}
                                value={localValues[metric.id] ?? 0}
                                onChange={(e) => handleChange(metric.id, e.target.value)}
                                className="w-14 h-6 text-xs text-right px-1.5"
                            />
                        ) : (
                            <span className="text-xs font-medium">
                                {localValues[metric.id] ?? period.metrics?.[metric.id] ?? 0}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
