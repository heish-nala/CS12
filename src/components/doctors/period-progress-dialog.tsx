'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PeriodProgress } from '@/lib/db/types';
import { format } from 'date-fns';
import { FileText, GraduationCap, TrendingUp } from 'lucide-react';

interface PeriodProgressDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    doctorId?: string;
    doctorName?: string;
}

export function PeriodProgressDialog({
    open,
    onOpenChange,
    doctorId,
    doctorName,
}: PeriodProgressDialogProps) {
    const [loading, setLoading] = useState(true);
    const [periods, setPeriods] = useState<PeriodProgress[]>([]);

    useEffect(() => {
        if (open && doctorId) {
            fetchPeriods();
        }
    }, [open, doctorId]);

    const fetchPeriods = async () => {
        if (!doctorId) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/doctors/${doctorId}/periods`);
            const data = await response.json();
            setPeriods(data || []);
        } catch (error) {
            console.error('Error fetching periods:', error);
        } finally {
            setLoading(false);
        }
    };

    const isCurrentPeriod = (period: PeriodProgress) => {
        const now = new Date();
        const start = new Date(period.start_date);
        const end = new Date(period.end_date);
        return now >= start && now <= end;
    };

    const getPeriodStatus = (period: PeriodProgress) => {
        const now = new Date();
        const end = new Date(period.end_date);

        if (now > end) return 'completed';
        if (isCurrentPeriod(period)) return 'current';
        return 'upcoming';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-gray-100 text-gray-700';
            case 'current':
                return 'bg-blue-100 text-blue-700';
            case 'upcoming':
                return 'bg-gray-50 text-gray-500';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const totalCases = periods.reduce((sum, p) => sum + p.cases_submitted, 0);
    const totalCourses = periods.reduce((sum, p) => sum + p.courses_completed, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Period Progress</DialogTitle>
                    <DialogDescription>
                        12-month onboarding progress for {doctorName || 'this doctor'}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 pt-4">
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(12)].map((_, i) => (
                            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-blue-700 mb-2">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-sm font-medium">Total Progress</span>
                                </div>
                                <div className="text-2xl font-bold text-blue-900">
                                    {periods.filter(p => getPeriodStatus(p) === 'completed').length}/12
                                </div>
                                <p className="text-xs text-blue-600 mt-1">Periods completed</p>
                            </div>

                            <div className="bg-green-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-green-700 mb-2">
                                    <FileText className="h-4 w-4" />
                                    <span className="text-sm font-medium">Total Cases</span>
                                </div>
                                <div className="text-2xl font-bold text-green-900">{totalCases}</div>
                                <p className="text-xs text-green-600 mt-1">Submitted</p>
                            </div>

                            <div className="bg-purple-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-purple-700 mb-2">
                                    <GraduationCap className="h-4 w-4" />
                                    <span className="text-sm font-medium">Total Courses</span>
                                </div>
                                <div className="text-2xl font-bold text-purple-900">{totalCourses}</div>
                                <p className="text-xs text-purple-600 mt-1">Completed</p>
                            </div>
                        </div>

                        {/* Period List */}
                        <div className="space-y-3">
                            {periods.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No period data available for this doctor.
                                </div>
                            ) : (
                                periods.map((period) => {
                                    const status = getPeriodStatus(period);
                                    const isCurrent = isCurrentPeriod(period);

                                    return (
                                        <div
                                            key={period.id}
                                            className={`border rounded-lg p-4 ${
                                                isCurrent ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'bg-white'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-semibold">
                                                            Period {period.period_number}
                                                        </h4>
                                                        {isCurrent && (
                                                            <Badge className="bg-blue-600">Current</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {format(new Date(period.start_date), 'MMM d, yyyy')} -{' '}
                                                        {format(new Date(period.end_date), 'MMM d, yyyy')}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={getStatusColor(status)}
                                                >
                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-2xl font-bold text-green-600">
                                                        {period.cases_submitted}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <FileText className="h-3 w-3" />
                                                        Cases Submitted
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-2xl font-bold text-purple-600">
                                                        {period.courses_completed}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <GraduationCap className="h-3 w-3" />
                                                        Courses Completed
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}
                </div>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
