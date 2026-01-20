import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { calculateRiskLevel, getDaysSinceActivity } from '@/lib/calculations/risk-level';
import { requireAuth, requireDsoAccess } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dsoId = searchParams.get('dso_id');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        // Require authentication
        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;
        }

        // If dsoId is provided, verify user has access
        if (dsoId) {
            const accessResult = await requireDsoAccess(request, dsoId);
            if ('response' in accessResult) {
                return accessResult.response;
            }
        }

        // Build query
        let query = supabase
            .from('doctors')
            .select(`
                *,
                dso:dsos(*),
                period_progress(*),
                activities(*)
            `)
            .order('created_at', { ascending: false });

        if (dsoId) {
            query = query.eq('dso_id', dsoId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: doctors, error } = await query;

        if (error) throw error;

        // Enrich doctors with computed fields
        const enrichedDoctors = (doctors || []).map((doctor) => {
            const periodProgress = doctor.period_progress || [];
            const activities = doctor.activities || [];
            const lastActivity = activities.length > 0
                ? activities.sort((a: { created_at: string }, b: { created_at: string }) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )[0]
                : null;

            // Calculate course progress percentage (based on 12-month program)
            const maxPeriod = periodProgress.length > 0
                ? Math.max(...periodProgress.map((p: { period_number: number }) => p.period_number))
                : 0;
            const courseProgressPercent = Math.round((maxPeriod / 12) * 100);

            return {
                ...doctor,
                risk_level: calculateRiskLevel(doctor, periodProgress, lastActivity),
                days_since_activity: getDaysSinceActivity(lastActivity),
                total_cases: periodProgress.reduce((sum: number, p: { cases_submitted: number }) => sum + p.cases_submitted, 0),
                total_courses: periodProgress.reduce((sum: number, p: { courses_completed: number }) => sum + p.courses_completed, 0),
                course_progress_percent: courseProgressPercent,
            };
        });

        return NextResponse.json({
            doctors: enrichedDoctors,
            total: enrichedDoctors.length,
        });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { dso_id, name, email, phone, start_date, status, notes } = body;

        if (!dso_id || !name || !start_date) {
            return NextResponse.json(
                { error: 'dso_id, name, and start_date are required' },
                { status: 400 }
            );
        }

        // Require write access to this DSO
        const accessResult = await requireDsoAccess(request, dso_id, true);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const { data, error } = await supabase
            .from('doctors')
            .insert({ dso_id, name, email, phone, start_date, status: status || 'active', notes })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ doctor: data }, { status: 201 });
    } catch (error) {
        console.error('Error creating doctor:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
