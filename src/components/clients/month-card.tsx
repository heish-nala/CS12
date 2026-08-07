'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { TimeTrackingMetric, PeriodData } from '@/lib/db/types';

interface MonthCardProps {
    period: PeriodData | null;
    previousPeriod?: PeriodData | null;
    metrics: TimeTrackingMetric[];
    isEditable?: boolean;
    isCurrent?: boolean;
    onChange?: (metricId: string, value: number) => void;
    onMentorshipChange?: (date: string | null) => void;
}

// Local-time YYYY-MM-DD (never toISOString — that shifts the date near midnight)
function toLocalDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MonthCard({
    period,
    previousPeriod,
    metrics,
    isEditable = false,
    isCurrent = false,
    onChange,
    onMentorshipChange,
}: MonthCardProps) {
    const [localValues, setLocalValues] = useState<Record<string, number>>({});
    const [mentorshipDate, setMentorshipDate] = useState<string | null>(null);

    useEffect(() => {
        if (period?.metrics) {
            setLocalValues(period.metrics);
        }
        setMentorshipDate(period?.mentorship_call_date ?? null);
    }, [period?.metrics, period?.mentorship_call_date]);

    const handleChange = (metricId: string, value: string) => {
        const numValue = parseInt(value, 10) || 0;
        setLocalValues((prev) => ({ ...prev, [metricId]: numValue }));
        onChange?.(metricId, numValue);
    };

    const handleMentorshipToggle = () => {
        if (!isEditable || !period) return;
        if (mentorshipDate) {
            setMentorshipDate(null);
            onMentorshipChange?.(null);
        } else {
            // Default to today, clamped into this card's month for backfills
            const today = toLocalDateString(new Date());
            const defaultDate = today > period.period_end
                ? period.period_end
                : today < period.period_start
                    ? period.period_start
                    : today;
            setMentorshipDate(defaultDate);
            onMentorshipChange?.(defaultDate);
        }
    };

    const handleMentorshipDateChange = (value: string) => {
        if (!value) return;
        setMentorshipDate(value);
        onMentorshipChange?.(value);
    };

    if (!period) return null;

    // Extract year from period_start for display (parse directly to avoid timezone issues)
    const periodYear = period.period_start.split('-')[0];
    const displayLabel = `${period.period_label} ${periodYear}`;

    // Past month = ended before today (string compare is safe on YYYY-MM-DD)
    const isPastMonth = period.period_end < toLocalDateString(new Date());
    const mentorshipDisplayDate = mentorshipDate
        ? new Date(mentorshipDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

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

            {/* Mentorship call - one per month */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-border">
                <span className="text-xs text-muted-foreground flex-1">Mentorship call</span>
                {!mentorshipDate && isPastMonth && (
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5">
                        No call logged
                    </span>
                )}
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!mentorshipDate}
                    aria-label={`Mentorship call ${mentorshipDate ? 'done' : 'not done'} for ${displayLabel}`}
                    onClick={handleMentorshipToggle}
                    disabled={!isEditable}
                    className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                        mentorshipDate
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-muted-foreground/40 bg-background'
                    } ${isEditable ? 'cursor-pointer hover:border-emerald-500' : 'cursor-default'}`}
                >
                    {mentorshipDate && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
                {mentorshipDate && (
                    isEditable ? (
                        <Input
                            type="date"
                            value={mentorshipDate}
                            min={period.period_start}
                            max={period.period_end}
                            onChange={(e) => handleMentorshipDateChange(e.target.value)}
                            className="w-32 h-6 text-xs px-1.5"
                        />
                    ) : (
                        <span className="text-xs font-medium text-emerald-600">{mentorshipDisplayDate}</span>
                    )
                )}
            </div>
        </div>
    );
}
