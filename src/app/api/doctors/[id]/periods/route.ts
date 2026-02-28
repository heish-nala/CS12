import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgDsoAccess } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get doctor to find their DSO for auth
        const { data: doctor } = await supabaseAdmin
            .from('doctors')
            .select('dso_id')
            .eq('id', id)
            .single();

        if (!doctor) {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }

        // Require org + DSO access
        const accessResult = await requireOrgDsoAccess(request, doctor.dso_id);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const { data: periods, error } = await supabaseAdmin
            .from('period_progress')
            .select('*')
            .eq('doctor_id', id)
            .order('period_number', { ascending: true });

        if (error) {
            console.error('Error fetching period progress:', error);
            return NextResponse.json([]);
        }

        return NextResponse.json(periods || []);
    } catch (error) {
        console.error('Error fetching period progress:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get doctor to find their DSO for auth (check existence first)
        const { data: doctor } = await supabaseAdmin
            .from('doctors')
            .select('dso_id')
            .eq('id', id)
            .single();

        if (!doctor) {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }

        // Parse body (after doctor check so we return 404 for invalid IDs)
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { periodNumber, updates } = body;

        // Require write access to the DSO (with user_id fallback from body)
        const accessResult = await requireOrgDsoAccess(request, doctor.dso_id, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const { data, error } = await supabaseAdmin
            .from('period_progress')
            .update(updates)
            .eq('doctor_id', id)
            .eq('period_number', periodNumber)
            .select()
            .single();

        if (error) {
            console.error('Error updating period progress:', error);
            return NextResponse.json(
                { error: 'Failed to update period progress' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error updating period progress:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
