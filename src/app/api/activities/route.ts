import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth, requireAuthWithFallback, requireOrgDsoAccess } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Require authentication
        const authResult = await requireAuthWithFallback(request);
        if ('response' in authResult) {
            return authResult.response;
        }

        const { searchParams } = new URL(request.url);
        const doctorId = searchParams.get('doctor_id');
        const contactName = searchParams.get('contact_name');
        const clientId = searchParams.get('client_id');
        const limit = parseInt(searchParams.get('limit') || '100');

        if (!clientId?.trim()) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        // Verify user has org + DSO access to this client
        const accessResult = await requireOrgDsoAccess(request, clientId);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        let query = supabaseAdmin
            .from('activities')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (doctorId) {
            query = query.eq('doctor_id', doctorId);
        }

        if (contactName) {
            query = query.eq('contact_name', contactName);
        }

        // Get doctors that belong to this client (for legacy activity lookup)
        const { data: clientDoctors } = await supabaseAdmin
            .from('doctors')
            .select('id')
            .eq('dso_id', clientId);

        const clientDoctorIds = clientDoctors?.map((doctor) => doctor.id) || [];
        let activities;
        let error;

        if (clientDoctorIds.length > 0) {
            let scopedQuery = supabaseAdmin
                .from('activities')
                .select('*')
                .or(`client_id.eq.${clientId},doctor_id.in.(${clientDoctorIds.join(',')})`)
                .order('created_at', { ascending: false });

            if (doctorId) {
                scopedQuery = scopedQuery.eq('doctor_id', doctorId);
            }

            if (contactName) {
                scopedQuery = scopedQuery.eq('contact_name', contactName);
            }

            const result = await scopedQuery.limit(limit);

            // If client_id column doesn't exist, fall back to doctor_id only
            if (result.error?.message?.includes('client_id')) {
                let fallbackQuery = supabaseAdmin
                    .from('activities')
                    .select('*')
                    .in('doctor_id', clientDoctorIds)
                    .order('created_at', { ascending: false });

                if (doctorId) {
                    fallbackQuery = fallbackQuery.eq('doctor_id', doctorId);
                }

                if (contactName) {
                    fallbackQuery = fallbackQuery.eq('contact_name', contactName);
                }

                const fallback = await fallbackQuery.limit(limit);
                activities = fallback.data;
                error = fallback.error;
            } else {
                activities = result.data;
                error = result.error;
            }
        } else {
            const result = await query;
            if (result.error?.message?.includes('client_id')) {
                // No client_id column and no doctors - return empty
                activities = [];
                error = null;
            } else {
                activities = result.data;
                error = result.error;
            }
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
            notable_quote,
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

        if (!client_id) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        const accessResult = await requireOrgDsoAccess(request, client_id, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;
        }
        const createdBy = authResult.user.email;

        const insertData: Record<string, any> = {
            activity_type,
            description,
            created_by: createdBy,
            client_id,
        };

        if (notable_quote) insertData.notable_quote = notable_quote;
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
