'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { TimeTrackingConfig, PeriodData } from '@/lib/db/types';
import { Calendar, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PeriodDataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rowId: string;
    rowName: string;
    timeTracking: TimeTrackingConfig;
    periods: PeriodData[];
    onUpdatePeriod: (periodId: string, metrics: Record<string, number>) => void;
}

export function PeriodDataDialog({
    open,
    onOpenChange,
    rowId,
    rowName,
    timeTracking,
    periods,
    onUpdatePeriod,
}: PeriodDataDialogProps) {
    const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Record<string, number>>({});

    // Get current period based on date
    const getCurrentPeriodId = () => {
        const now = new Date();
        const currentPeriod = periods.find(p => {
            const start = new Date(p.period_start);
            const end = new Date(p.period_end);
            return now >= start && now <= end;
        });
        return currentPeriod?.id;
    };

    const currentPeriodId = getCurrentPeriodId();

    // Calculate totals
    const totals: Record<string, number> = {};
    timeTracking.metrics.forEach(metric => {
        totals[metric.id] = periods.reduce((sum, p) => sum + (p.metrics[metric.id] || 0), 0);
    });

    const startEditing = (period: PeriodData) => {
        setEditingPeriodId(period.id);
        setEditValues({ ...period.metrics });
    };

    const cancelEditing = () => {
        setEditingPeriodId(null);
        setEditValues({});
    };

    const saveEditing = (periodId: string) => {
        onUpdatePeriod(periodId, editValues);
        setEditingPeriodId(null);
        setEditValues({});
    };

    const handleValueChange = (metricId: string, value: string) => {
        setEditValues(prev => ({
            ...prev,
            [metricId]: parseFloat(value) || 0,
        }));
    };

    // Filter and sort periods by date
    // For weekly frequency, only show periods within previous month, current month, and next month
    const getFilteredPeriods = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Calculate previous and next month (handling year boundaries)
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

        return periods.filter(p => {
            const periodStart = new Date(p.period_start);
            const periodMonth = periodStart.getMonth();
            const periodYear = periodStart.getFullYear();

            // Check if period is in previous, current, or next month
            const isPrevMonth = periodMonth === prevMonth && periodYear === prevYear;
            const isCurrentMonth = periodMonth === currentMonth && periodYear === currentYear;
            const isNextMonth = periodMonth === nextMonth && periodYear === nextYear;

            return isPrevMonth || isCurrentMonth || isNextMonth;
        });
    };

    const sortedPeriods = getFilteredPeriods().sort(
        (a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
    );

    // Get period type label for header
    const getPeriodTypeLabel = () => {
        switch (timeTracking.frequency) {
            case 'weekly': return 'Week';
            case 'monthly': return 'Month';
            case 'quarterly': return 'Quarter';
            default: return 'Period';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <DialogTitle>Period Progress - {rowName}</DialogTitle>
                            <p className="text-sm text-muted-foreground">
                                {periods.length} periods tracked ({timeTracking.frequency}) - Click edit to update metrics
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col px-4 pt-4 overflow-hidden">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3 flex-shrink-0">
                    {timeTracking.metrics.map((metric, index) => {
                        const colors = [
                            { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', value: 'text-blue-900' },
                            { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', value: 'text-emerald-900' },
                            { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', value: 'text-purple-900' },
                        ];
                        const color = colors[index % colors.length];

                        return (
                            <div key={metric.id} className={cn('rounded-lg p-3 border', color.bg)}>
                                <div className={cn('text-sm font-medium', color.text)}>
                                    Total {metric.name}
                                </div>
                                <div className={cn('text-2xl font-bold', color.value)}>
                                    {totals[metric.id]?.toLocaleString() || 0}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Period Table */}
                <div className="flex-1 overflow-auto mt-3 border rounded-lg">
                    <table className="w-full">
                        <thead className="bg-muted sticky top-0 z-10">
                            <tr>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                                    {getPeriodTypeLabel()}
                                </th>
                                {timeTracking.metrics.map(metric => (
                                    <th key={metric.id} className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                                        {metric.name}
                                    </th>
                                ))}
                                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPeriods.map((period) => {
                                const isCurrentPeriod = period.id === currentPeriodId;
                                const isEditing = editingPeriodId === period.id;

                                return (
                                    <tr
                                        key={period.id}
                                        className={cn(
                                            'border-t transition-colors',
                                            isCurrentPeriod && 'bg-blue-50/50',
                                            isEditing && 'bg-amber-50/50'
                                        )}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">
                                                    {period.period_label}
                                                </span>
                                                {isCurrentPeriod && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded font-medium">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {timeTracking.metrics.map(metric => (
                                            <td key={metric.id} className="px-4 py-3 text-center">
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        value={editValues[metric.id] || 0}
                                                        onChange={(e) => handleValueChange(metric.id, e.target.value)}
                                                        className="h-8 w-20 mx-auto text-center"
                                                        autoFocus={metric === timeTracking.metrics[0]}
                                                    />
                                                ) : (
                                                    <span className={cn(
                                                        'text-sm',
                                                        (period.metrics[metric.id] || 0) > 0
                                                            ? 'text-blue-600 font-medium'
                                                            : 'text-muted-foreground'
                                                    )}>
                                                        {period.metrics[metric.id] || 0}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                        <td className="px-4 py-3 text-center">
                                            {isEditing ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                                        onClick={() => saveEditing(period.id)}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                        onClick={cancelEditing}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className={cn(
                                                        'h-7 w-7 p-0',
                                                        isCurrentPeriod
                                                            ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-100 ring-1 ring-blue-300'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    )}
                                                    onClick={() => startEditing(period)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
