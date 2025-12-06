import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { DashboardMetrics } from '@/lib/db/types';
import { calculateRiskLevel, getDaysSinceActivity } from '@/lib/calculations/risk-level';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const dsoId = searchParams.get('dso_id');

        // Fetch doctors with related data
        let query = supabase
            .from('doctors')
            .select(`
                *,
                period_progress(*),
                activities(*)
            `);

        if (dsoId) {
            query = query.eq('dso_id', dsoId);
        }

        const { data: doctorsData, error } = await query;
        if (error) throw error;

        const doctors = doctorsData || [];

        // Calculate metrics
        const totalDoctors = doctors.length;
        const activeDoctors = doctors.filter(d => d.status === 'active').length;

        // Calculate risk levels for all doctors
        const doctorsWithRisk = doctors.map(doctor => {
            const periodProgress = doctor.period_progress || [];
            const activities = doctor.activities || [];
            const lastActivity = activities.length > 0
                ? activities.sort((a: { created_at: string }, b: { created_at: string }) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )[0]
                : null;
            const riskLevel = calculateRiskLevel(doctor, periodProgress, lastActivity);
            const daysSinceActivity = getDaysSinceActivity(lastActivity);

            return {
                ...doctor,
                risk_level: riskLevel,
                days_since_activity: daysSinceActivity,
                period_progress: periodProgress,
                last_activity: lastActivity,
            };
        });

        const riskDistribution = {
            low: doctorsWithRisk.filter(d => d.risk_level === 'low').length,
            medium: doctorsWithRisk.filter(d => d.risk_level === 'medium').length,
            high: doctorsWithRisk.filter(d => d.risk_level === 'high').length,
            critical: doctorsWithRisk.filter(d => d.risk_level === 'critical').length,
        };

        const atRiskCount = riskDistribution.high + riskDistribution.critical;
        const criticalRiskCount = riskDistribution.critical;

        // Calculate this month's cases and courses
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        const allPeriodProgress = doctors.flatMap(d => d.period_progress || []);
        const relevantPeriods = allPeriodProgress.filter(p => {
            const periodStart = new Date(p.start_date);
            const periodEnd = new Date(p.end_date);
            return (
                (periodStart.getMonth() === currentMonth && periodStart.getFullYear() === currentYear) ||
                (periodEnd.getMonth() === currentMonth && periodEnd.getFullYear() === currentYear) ||
                (periodStart <= currentDate && periodEnd >= currentDate)
            );
        });

        const totalCasesThisMonth = relevantPeriods.reduce((sum, p) => sum + p.cases_submitted, 0);
        const totalCoursesThisMonth = relevantPeriods.reduce((sum, p) => sum + p.courses_completed, 0);

        // Customer Success Metrics

        // Average days in program
        const avgDaysInProgram = doctors.reduce((sum, doctor) => {
            const startDate = new Date(doctor.start_date);
            const days = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
        }, 0) / (totalDoctors || 1);

        // Engagement rate (doctors with activity in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const engagedDoctors = doctorsWithRisk.filter(d => {
            if (!d.last_activity) return false;
            const activityDate = new Date(d.last_activity.created_at);
            return activityDate >= sevenDaysAgo;
        }).length;
        const engagementRate = totalDoctors > 0 ? (engagedDoctors / totalDoctors) * 100 : 0;

        // Average cases and courses per doctor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalCases = doctorsWithRisk.reduce((sum: number, d: any) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sum + d.period_progress.reduce((s: number, p: any) => s + p.cases_submitted, 0), 0
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalCourses = doctorsWithRisk.reduce((sum: number, d: any) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sum + d.period_progress.reduce((s: number, p: any) => s + p.courses_completed, 0), 0
        );
        const avgCasesPerDoctor = totalDoctors > 0 ? totalCases / totalDoctors : 0;
        const avgCoursesPerDoctor = totalDoctors > 0 ? totalCourses / totalDoctors : 0;

        // Doctors needing attention (no activity in 14+ days)
        const doctorsNeedingAttention = doctorsWithRisk.filter(d =>
            d.days_since_activity === undefined || d.days_since_activity >= 14
        ).length;

        // Recent activities count (last 7 days)
        const allActivities = doctors.flatMap(d => d.activities || []);
        const relevantActivities = allActivities.filter(a => {
            const activityDate = new Date(a.created_at);
            return activityDate >= sevenDaysAgo;
        });
        const recentActivitiesCount = relevantActivities.length;

        // On track count (doctors with low or medium risk)
        const onTrackCount = riskDistribution.low + riskDistribution.medium;

        // Completion rate (simplified: doctors with cases/courses in current period)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doctorsWithProgress = doctorsWithRisk.filter((d: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentPeriod = d.period_progress.find((p: any) => {
                const start = new Date(p.start_date);
                const end = new Date(p.end_date);
                return currentDate >= start && currentDate <= end;
            });
            return currentPeriod && (currentPeriod.cases_submitted > 0 || currentPeriod.courses_completed > 0);
        }).length;
        const completionRate = totalDoctors > 0 ? (doctorsWithProgress / totalDoctors) * 100 : 0;

        const metrics: DashboardMetrics = {
            total_doctors: totalDoctors,
            active_doctors: activeDoctors,
            at_risk_count: atRiskCount,
            critical_risk_count: criticalRiskCount,
            total_cases_this_month: totalCasesThisMonth,
            total_courses_this_month: totalCoursesThisMonth,
            risk_distribution: riskDistribution,
            average_days_in_program: Math.round(avgDaysInProgram),
            engagement_rate: Math.round(engagementRate),
            avg_cases_per_doctor: Math.round(avgCasesPerDoctor * 10) / 10,
            avg_courses_per_doctor: Math.round(avgCoursesPerDoctor * 10) / 10,
            doctors_needing_attention: doctorsNeedingAttention,
            recent_activities_count: recentActivitiesCount,
            on_track_count: onTrackCount,
            completion_rate: Math.round(completionRate),
        };

        return NextResponse.json(metrics);
    } catch (error) {
        console.error('Error calculating dashboard metrics:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
