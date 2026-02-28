
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/db/client';
import { requireOrgDsoAccess } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // First fetch the doctor to get its dso_id
        const { data: doctor, error } = await supabase
            .from('doctors')
            .select(`
    *,
    dso: dsos(*),
        period_progress(*),
        activities(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!doctor) {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }

        // Verify user has org + DSO access
        const accessResult = await requireOrgDsoAccess(request, doctor.dso_id);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        return NextResponse.json(doctor);
    } catch (error) {
        console.error('Error fetching doctor:', error);
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
        const body = await request.json();
        const { name, email, phone, status, notes } = body;

        // First fetch the doctor to get its dso_id
        const { data: existingDoctor, error: fetchError } = await supabaseAdmin
            .from('doctors')
            .select('dso_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingDoctor) {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }

        // Verify user has write access to this doctor's DSO (with user_id fallback from body)
        const accessResult = await requireOrgDsoAccess(request, existingDoctor.dso_id, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const { data: doctor, error } = await supabaseAdmin
            .from('doctors')
            .update({ name, email, phone, status, notes })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(doctor);
    } catch (error) {
        console.error('Error updating doctor:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // First fetch the doctor to get its dso_id
        const { data: existingDoctor, error: fetchError } = await supabaseAdmin
            .from('doctors')
            .select('dso_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingDoctor) {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }

        // Verify user has write access to this doctor's DSO (admin required for delete)
        const accessResult = await requireOrgDsoAccess(request, existingDoctor.dso_id, true);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const { error } = await supabaseAdmin
            .from('doctors')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting doctor:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
