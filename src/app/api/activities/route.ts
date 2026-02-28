import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth, requireAuthWithFallback, requireOrgDsoAccess } from '@/lib/auth';

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
        let useClientIdFilter = false;
        let clientDoctorIds: string[] = [];

        if (clientId) {
            // Verify user has org + DSO access to this client
            const accessResult = await requireOrgDsoAccess(request, clientId);
            if ('response' in accessResult) {
                return accessResult.response;
            }

            // Get doctors that belong to this client (for legacy activity lookup)
            const { data: clientDoctors } = await supabaseAdmin
                .from('doctors')
                .select('id')
                .eq('dso_id', clientId);

            clientDoctorIds = clientDoctors?.map(d => d.id) || [];
            useClientIdFilter = true;
        }

        if (doctorId) {
            query = query.eq('doctor_id', doctorId);
        }

        // Support filtering by contact_name for data table rows
        if (contactName) {
            query = query.eq('contact_name', contactName);
        }

        let activities;
        let error;

        if (useClientIdFilter && clientDoctorIds.length > 0) {
            // Try with client_id filter first (includes client_id OR doctor_id match)
            const result = await supabaseAdmin
                .from('activities')
                .select('*')
                .or(`client_id.eq.${clientId},doctor_id.in.(${clientDoctorIds.join(',')})`)
                .order('created_at', { ascending: false })
                .limit(limit);

            // If client_id column doesn't exist, fall back to doctor_id only
            if (result.error?.message?.includes('client_id')) {
                const fallback = await supabaseAdmin
                    .from('activities')
                    .select('*')
                    .in('doctor_id', clientDoctorIds)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                activities = fallback.data;
                error = fallback.error;
            } else {
                activities = result.data;
                error = result.error;
            }
        } else if (useClientIdFilter) {
            // No doctors, try client_id only with fallback
            const result = await query;
            if (result.error?.message?.includes('client_id')) {
                // No client_id column and no doctors - return empty
                activities = [];
                error = null;
            } else {
                activities = result.data;
                error = result.error;
            }
        } else {
            const result = await query;
            activities = result.data;
            error = result.error;
        }

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
        } = body;

        if (!activity_type || !description) {
            return NextResponse.json(
                { error: 'Activity type and description are required' },
                { status: 400 }
            );
        }

        // Verify user has org + DSO access to the client if provided (with user_id fallback from body)
        if (client_id) {
            const accessResult = await requireOrgDsoAccess(request, client_id, true, body);
            if ('response' in accessResult) {
                return accessResult.response;
            }

            // Get the user info for created_by
            const authResult = await requireAuth(request);
            let createdBy: string;
            if ('response' in authResult) {
                // Fallback: use user_id from body
                createdBy = body.user_id || 'unknown';
            } else {
                createdBy = authResult.user.email;
            }

            // Build insert object, only including fields that have values
            const insertData: Record<string, any> = {
                activity_type,
                description,
                created_by: createdBy,
            };

            // Only include optional fields if they have values
            if (outcome) insertData.outcome = outcome;
            if (contact_name) insertData.contact_name = contact_name;
            if (contact_email) insertData.contact_email = contact_email;
            if (contact_phone) insertData.contact_phone = contact_phone;
            if (doctor_id) insertData.doctor_id = doctor_id;
            if (client_id) insertData.client_id = client_id;

            const { data, error } = await supabaseAdmin
                .from('activities')
                .insert(insertData)
                .select()
                .single();

            // If client_id column doesn't exist yet, retry without it
            if (error?.message?.includes('client_id')) {
                delete insertData.client_id;
                const { data: retryData, error: retryError } = await supabaseAdmin
                    .from('activities')
                    .insert(insertData)
                    .select()
                    .single();
                if (retryError) throw retryError;
                return NextResponse.json(retryData, { status: 201 });
            }

            if (error) throw error;

            return NextResponse.json(data, { status: 201 });
        }

        // No client_id — require basic auth
        const authResult = await requireAuth(request);
        let createdBy: string;

        if ('response' in authResult) {
            // Session auth failed, try user_id from body
            if (!body.user_id) {
                return authResult.response;
            }
            createdBy = body.user_id;
        } else {
            createdBy = authResult.user.email;
        }

        // Build insert object, only including fields that have values
        const insertData: Record<string, any> = {
            activity_type,
            description,
            created_by: createdBy,
        };

        // Only include optional fields if they have values
        if (outcome) insertData.outcome = outcome;
        if (contact_name) insertData.contact_name = contact_name;
        if (contact_email) insertData.contact_email = contact_email;
        if (contact_phone) insertData.contact_phone = contact_phone;
        if (doctor_id) insertData.doctor_id = doctor_id;

        const { data, error } = await supabaseAdmin
            .from('activities')
            .insert(insertData)
            .select()
            .single();

        // If client_id column doesn't exist yet, retry without it
        if (error?.message?.includes('client_id')) {
            delete insertData.client_id;
            const { data: retryData, error: retryError } = await supabaseAdmin
                .from('activities')
                .insert(insertData)
                .select()
                .single();
            if (retryError) throw retryError;
            return NextResponse.json(retryData, { status: 201 });
        }

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
