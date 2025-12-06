import { NextRequest, NextResponse } from 'next/server';
import { calculateRiskLevel, getDaysSinceActivity } from '@/lib/calculations/risk-level';
import {
    mockDoctors,
    mockDSOs,
    getDoctorsByDSO,
    getDoctorsByStatus,
    searchDoctors,
    getPeriodProgressByDoctor,
    getLastActivityByDoctor,
    getDSOById
} from '@/lib/mock-data';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dsoId = searchParams.get('dso_id');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        // Filter doctors based on query parameters
        let doctors = [...mockDoctors];

        if (dsoId) {
            doctors = getDoctorsByDSO(dsoId);
        }

        if (status) {
            doctors = doctors.filter(d => d.status === status);
        }

        if (search) {
            doctors = searchDoctors(search);
        }

        // Enrich doctors with computed fields and DSO data
        const enrichedDoctors = doctors.map((doctor) => {
            const dso = getDSOById(doctor.dso_id);
            const periodProgress = getPeriodProgressByDoctor(doctor.id);
            const lastActivity = getLastActivityByDoctor(doctor.id);

            // Calculate course progress percentage (based on 12-month program)
            const maxPeriod = periodProgress.length > 0
                ? Math.max(...periodProgress.map(p => p.period_number))
                : 0;
            const courseProgressPercent = Math.round((maxPeriod / 12) * 100);

            return {
                ...doctor,
                dso,
                risk_level: calculateRiskLevel(doctor, periodProgress, lastActivity),
                days_since_activity: getDaysSinceActivity(lastActivity),
                total_cases: periodProgress.reduce((sum, p) => sum + p.cases_submitted, 0),
                total_courses: periodProgress.reduce((sum, p) => sum + p.courses_completed, 0),
                course_progress_percent: courseProgressPercent,
            };
        });

        // Sort by created_at descending
        enrichedDoctors.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

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

// POST disabled for mock data mode
export async function POST(request: NextRequest) {
    return NextResponse.json(
        { error: 'Creating doctors is disabled in mock data mode' },
        { status: 503 }
    );
}
