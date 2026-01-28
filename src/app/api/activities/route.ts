import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth, requireAuthWithFallback, checkDsoAccess } from '@/lib/auth';

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
        const clientId = searchParams.get('client_id');
        const limit = parseInt(searchParams.get('limit') || '100');

        let query = supabaseAdmin
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        // Filter by client_id if provided (required for proper scoping)
        if (clientId) {
            // Verify user has access to this client
            const { hasAccess } = await checkDsoAccess(authResult.userId, clientId);
            if (!hasAccess) {
                return NextResponse.json(
                    { error: 'Access denied to this workspace' },
                    { status: 403 }
                );
            }

            // Get activities that either:
            // 1. Have matching client_id, OR
            // 2. Have a doctor_id that belongs to this client (legacy support)
            const { data: clientDoctors } = await supabaseAdmin
                .from('doctors')
                .select('id')
                .eq('dso_id', clientId);

            const doctorIds = clientDoctors?.map(d => d.id) || [];

            if (doctorIds.length > 0) {
                // Include activities with matching client_id OR doctor from this client
                query = query.or(`client_id.eq.${clientId},doctor_id.in.(${doctorIds.join(',')})`);
            } else {
                // No doctors, just filter by client_id
                query = query.eq('client_id', clientId);
            }
        }

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
            client_id,
            doctor_id,
            user_id, // Fallback auth from body
        } = body;

        // Try session auth first, fallback to user_id from body
        const authResult = await requireAuth(request);
        let createdBy: string;
        let userId: string;

        if ('response' in authResult) {
            // Session auth failed, try user_id from body
            if (!user_id) {
                return authResult.response;
            }
            createdBy = user_id;
            userId = user_id;
        } else {
            createdBy = authResult.user.email;
            userId = authResult.user.id;
        }

        if (!activity_type || !description) {
            return NextResponse.json(
                { error: 'Activity type and description are required' },
                { status: 400 }
            );
        }

        // Verify user has access to the client if provided
        if (client_id) {
            const { hasAccess, role } = await checkDsoAccess(userId, client_id);
            if (!hasAccess || (role !== 'admin' && role !== 'manager')) {
                return NextResponse.json(
                    { error: 'Write access required to create activities' },
                    { status: 403 }
                );
            }
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
                client_id,
                doctor_id,
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
