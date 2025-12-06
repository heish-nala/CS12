import { PeriodProgress } from '../db/types';

export interface MonthlyMetrics {
    year: number;
    month: number;
    cases_submitted: number;
    courses_completed: number;
}

/**
 * Aggregate period progress data into calendar months
 * Handles overlapping periods by proportionally distributing metrics
 */
export function aggregateMonthlyMetrics(
    periodProgress: PeriodProgress[],
    startDate: Date,
    endDate: Date
): MonthlyMetrics[] {
    const monthlyData = new Map<string, MonthlyMetrics>();

    // Initialize months in range
    const current = new Date(startDate);
    while (current <= endDate) {
        const key = `${current.getFullYear()}-${current.getMonth() + 1}`;
        monthlyData.set(key, {
            year: current.getFullYear(),
            month: current.getMonth() + 1,
            cases_submitted: 0,
            courses_completed: 0,
        });
        current.setMonth(current.getMonth() + 1);
    }

    // Distribute period metrics across calendar months
    for (const period of periodProgress) {
        const periodStart = new Date(period.start_date);
        const periodEnd = new Date(period.end_date);
        const periodDays = Math.ceil(
            (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Find overlapping months
        const current = new Date(periodStart);
        while (current <= periodEnd) {
            const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
            const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

            // Calculate overlap
            const overlapStart = new Date(Math.max(periodStart.getTime(), monthStart.getTime()));
            const overlapEnd = new Date(Math.min(periodEnd.getTime(), monthEnd.getTime()));
            const overlapDays = Math.ceil(
                (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;

            // Proportionally distribute metrics
            const proportion = overlapDays / periodDays;
            const key = `${current.getFullYear()}-${current.getMonth() + 1}`;
            const monthData = monthlyData.get(key);

            if (monthData) {
                monthData.cases_submitted += Math.round(period.cases_submitted * proportion);
                monthData.courses_completed += Math.round(period.courses_completed * proportion);
            }

            current.setMonth(current.getMonth() + 1);
        }
    }

    return Array.from(monthlyData.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
}

/**
 * Get metrics for current month
 */
export function getCurrentMonthMetrics(periodProgress: PeriodProgress[]): MonthlyMetrics {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const metrics = aggregateMonthlyMetrics(periodProgress, monthStart, monthEnd);
    return metrics[0] || {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        cases_submitted: 0,
        courses_completed: 0,
    };
}

/**
 * Calculate total metrics across all periods
 */
export function getTotalMetrics(periodProgress: PeriodProgress[]) {
    return periodProgress.reduce(
        (totals, period) => ({
            cases_submitted: totals.cases_submitted + period.cases_submitted,
            courses_completed: totals.courses_completed + period.courses_completed,
        }),
        { cases_submitted: 0, courses_completed: 0 }
    );
}
