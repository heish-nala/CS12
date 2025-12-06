import { NextRequest, NextResponse } from 'next/server';
import { mockActivities, getActivitiesByDoctor } from '@/lib/mock-data';
import { Activity } from '@/lib/db/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const doctorId = searchParams.get('doctor_id');
        const limit = parseInt(searchParams.get('limit') || '100');

        let activities = [...mockActivities];

        if (doctorId) {
            activities = getActivitiesByDoctor(doctorId);
        }

        // Sort by created_at descending
        activities.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Apply limit
        activities = activities.slice(0, limit);

        return NextResponse.json(activities);
    } catch (error) {
        console.error('Error fetching activities:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            doctor_id,
            activity_type,
            description,
            outcome,
            contact_name,
            contact_email,
            contact_phone,
            created_by,
        } = body;

        if (!activity_type || !description) {
            return NextResponse.json(
                { error: 'Activity type and description are required' },
                { status: 400 }
            );
        }

        const newActivity: Activity = {
            id: String(mockActivities.length + 1),
            doctor_id: doctor_id || '',
            activity_type,
            description,
            outcome,
            contact_name,
            contact_email,
            contact_phone,
            created_by: created_by || 'current-user',
            created_at: new Date().toISOString(),
        };

        // Add to mock data (in-memory, will reset on server restart)
        mockActivities.unshift(newActivity);

        return NextResponse.json(newActivity, { status: 201 });
    } catch (error) {
        console.error('Error creating activity:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
