import { Doctor, PeriodProgress, Activity, RiskLevel } from '../db/types';

/**
 * Calculate risk level for a doctor based on engagement metrics and activity
 * 
 * Risk Levels:
 * - Critical: No activity in 14+ days OR (no activity in 7+ days AND low engagement)
 * - High: No activity in 7+ days OR very low engagement
 * - Medium: Low engagement OR no recent activity (3-7 days)
 * - Low: Active with good engagement
 */
export function calculateRiskLevel(
    doctor: Doctor,
    periodProgress: PeriodProgress[],
    lastActivity?: Activity | null
): RiskLevel {
    const now = new Date();
    const daysSinceActivity = lastActivity
        ? Math.floor((now.getTime() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

    // Calculate engagement score
    const totalCases = periodProgress.reduce((sum, p) => sum + p.cases_submitted, 0);
    const totalCourses = periodProgress.reduce((sum, p) => sum + p.courses_completed, 0);
    const monthsSinceStart = Math.floor(
        (now.getTime() - new Date(doctor.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    const expectedCases = Math.max(monthsSinceStart * 2, 1); // Expect ~2 cases per month
    const expectedCourses = Math.max(monthsSinceStart * 1, 1); // Expect ~1 course per month

    const caseEngagement = totalCases / expectedCases;
    const courseEngagement = totalCourses / expectedCourses;
    const engagementScore = (caseEngagement + courseEngagement) / 2;

    // Critical risk conditions
    if (daysSinceActivity >= 14) {
        return 'critical';
    }
    if (daysSinceActivity >= 7 && engagementScore < 0.3) {
        return 'critical';
    }

    // High risk conditions
    if (daysSinceActivity >= 7) {
        return 'high';
    }
    if (engagementScore < 0.2) {
        return 'high';
    }

    // Medium risk conditions
    if (daysSinceActivity >= 3 || engagementScore < 0.5) {
        return 'medium';
    }

    // Low risk (healthy engagement)
    return 'low';
}

/**
 * Check if a doctor has breached SLA (7+ days without activity)
 */
export function hasSLABreach(lastActivity?: Activity | null): boolean {
    if (!lastActivity) return true;

    const now = new Date();
    const daysSinceActivity = Math.floor(
        (now.getTime() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceActivity >= 7;
}

/**
 * Get days since last activity
 */
export function getDaysSinceActivity(lastActivity?: Activity | null): number {
    if (!lastActivity) return 999;

    const now = new Date();
    return Math.floor(
        (now.getTime() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
}
