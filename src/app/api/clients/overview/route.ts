import { NextResponse } from 'next/server';
import {
    mockClients,
    mockDoctors,
    getPeriodProgressByDoctor,
    getLastActivityByDoctor,
} from '@/lib/mock-data';
import { calculateRiskLevel, getDaysSinceActivity } from '@/lib/calculations/risk-level';

export async function GET() {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const clientsWithMetrics = mockClients.map((client) => {
            // Get all doctors for this client
            const clientDoctors = mockDoctors.filter(d => d.dso_id === client.id);

            // Calculate metrics for each doctor
            const doctorsWithData = clientDoctors.map(doctor => {
                const periodProgress = getPeriodProgressByDoctor(doctor.id);
                const lastActivity = getLastActivityByDoctor(doctor.id);
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

            // Calculate aggregate metrics
            const totalDoctors = doctorsWithData.length;
            const activeDoctors = doctorsWithData.filter(d => d.status === 'active').length;
            const atRiskCount = doctorsWithData.filter(d =>
                d.risk_level === 'high' || d.risk_level === 'critical'
            ).length;

            // Engagement rate
            const engagedDoctors = doctorsWithData.filter(d => {
                if (!d.last_activity) return false;
                const activityDate = new Date(d.last_activity.created_at);
                return activityDate >= sevenDaysAgo;
            }).length;
            const engagementRate = totalDoctors > 0 ? Math.round((engagedDoctors / totalDoctors) * 100) : 0;

            // Total cases and courses
            const totalCases = doctorsWithData.reduce((sum, d) =>
                sum + d.period_progress.reduce((s, p) => s + p.cases_submitted, 0), 0
            );
            const totalCourses = doctorsWithData.reduce((sum, d) =>
                sum + d.period_progress.reduce((s, p) => s + p.courses_completed, 0), 0
            );

            // Calculate average course progress percentage (based on 12-month program)
            const totalProgress = doctorsWithData.reduce((sum, d) => {
                const maxPeriod = d.period_progress.length > 0
                    ? Math.max(...d.period_progress.map(p => p.period_number))
                    : 0;
                return sum + (maxPeriod / 12) * 100;
            }, 0);
            const avgCourseProgress = totalDoctors > 0 ?
                Math.round(totalProgress / totalDoctors) : 0;

            return {
                ...client,
                metrics: {
                    client_id: client.id,
                    total_doctors: totalDoctors,
                    active_doctors: activeDoctors,
                    at_risk_count: atRiskCount,
                    engagement_rate: engagementRate,
                    total_cases: totalCases,
                    total_courses: totalCourses,
                    avg_course_progress: avgCourseProgress,
                },
            };
        });

        return NextResponse.json({ clients: clientsWithMetrics });
    } catch (error) {
        console.error('Error fetching clients overview:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
