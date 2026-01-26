import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth, requireAuthWithFallback } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Require authentication (with user_id param fallback for GET)
        const authResult = await requireAuthWithFallback(request);
        if ('response' in authResult) {
            return authResult.response;
        }

        const { searchParams } = new URL(request.url);
        const doctorId = searchParams.get('doctor_id');
        const contactName = searchParams.get('contact_name');
        const limit = parseInt(searchParams.get('limit') || '100');

        let query = supabaseAdmin
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (doctorId) {
            query = query.eq('doctor_id', doctorId);
        }

        // Support filtering by contact_name for data table rows
        if (contactName) {
            query = query.eq('contact_name', contactName);
        }

        const { data: activities, error } = await query;

        if (error) throw error;

        return NextResponse.json({ activities: activities || [] });
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
            activity_type,
            description,
            outcome,
            contact_name,
            contact_email,
            contact_phone,
            user_id, // Fallback auth from body
        } = body;

        // Try session auth first, fallback to user_id from body
        const authResult = await requireAuth(request);
        let createdBy: string;

        if ('response' in authResult) {
            // Session auth failed, try user_id from body
            if (!user_id) {
                return authResult.response;
            }
            createdBy = user_id;
        } else {
            createdBy = authResult.user.email;
        }

        if (!activity_type || !description) {
            return NextResponse.json(
                { error: 'Activity type and description are required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('activities')
            .insert({
                activity_type,
                description,
                outcome,
                contact_name,
                contact_email,
                contact_phone,
                created_by: createdBy,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('Error creating activity:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
