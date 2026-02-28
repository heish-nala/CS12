import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { calculateRiskLevel, getDaysSinceActivity } from '@/lib/calculations/risk-level';
import { requireAuth, getUserOrg } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Try to get user from session, fall back to user_id param
        const authResult = await requireAuth(request);
        let userId: string;
        if ('response' in authResult) {
            // Session auth failed, try user_id param as fallback
            const userIdParam = searchParams.get('user_id');
            if (!userIdParam) {
                return NextResponse.json({ clients: [] });
            }
            userId = userIdParam;
        } else {
            userId = authResult.user.id;
        }

        // Get user's org (org boundary check for enumeration routes)
        const orgInfo = await getUserOrg(userId);
        if (!orgInfo) {
            return NextResponse.json({ clients: [] });
        }

        // Get DSOs that the user has access to, filtered by org
        const { data: accessRecords, error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id, dsos!inner(org_id)')
            .eq('user_id', userId)
            .eq('dsos.org_id', orgInfo.orgId);

        if (accessError) throw accessError;

        // If user has no access to any DSOs within their org, return empty array
        if (!accessRecords || accessRecords.length === 0) {
            return NextResponse.json({ clients: [] });
        }

        const dsoIds = accessRecords.map(r => r.dso_id);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Fetch only DSOs the user has access to
        const { data: clients, error } = await supabaseAdmin
            .from('dsos')
            .select(`
                *,
                doctors(
                    *,
                    period_progress(*),
                    activities(*)
                )
            `)
            .in('id', dsoIds)
            .or('archived.is.null,archived.eq.false');

        if (error) throw error;

        const clientsWithMetrics = (clients || []).map((client) => {
            // Get all doctors for this client
            const clientDoctors = client.doctors || [];

            // Calculate metrics for each doctor
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const doctorsWithData = clientDoctors.map((doctor: any) => {
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

            // Calculate aggregate metrics
            const totalDoctors = doctorsWithData.length;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const activeDoctors = doctorsWithData.filter((d: any) => d.status === 'active').length;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const atRiskCount = doctorsWithData.filter((d: any) =>
                d.risk_level === 'high' || d.risk_level === 'critical'
            ).length;

            // Engagement rate
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const engagedDoctors = doctorsWithData.filter((d: any) => {
                if (!d.last_activity) return false;
                const activityDate = new Date(d.last_activity.created_at);
                return activityDate >= sevenDaysAgo;
            }).length;
            const engagementRate = totalDoctors > 0 ? Math.round((engagedDoctors / totalDoctors) * 100) : 0;

            // Total cases and courses
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const totalCases = doctorsWithData.reduce((sum: number, d: any) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sum + d.period_progress.reduce((s: number, p: any) => s + p.cases_submitted, 0), 0
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const totalCourses = doctorsWithData.reduce((sum: number, d: any) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sum + d.period_progress.reduce((s: number, p: any) => s + p.courses_completed, 0), 0
            );

            // Calculate average course progress percentage (based on 12-month program)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const totalProgress = doctorsWithData.reduce((sum: number, d: any) => {
                const maxPeriod = d.period_progress.length > 0
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? Math.max(...d.period_progress.map((p: any) => p.period_number))
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
