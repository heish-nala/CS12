
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/db/client';
import { requireAuth, checkDsoAccess, hasWriteAccess } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require authentication
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const currentUser = authResult.user;

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

        // Verify user has access to this doctor's DSO
        const { hasAccess } = await checkDsoAccess(currentUser.id, doctor.dso_id);
        if (!hasAccess) {
            return NextResponse.json(
                { error: 'Access denied to this doctor' },
                { status: 403 }
            );
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
        // Require authentication
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const currentUser = authResult.user;

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

        // Verify user has write access to this doctor's DSO
        const { hasAccess, role } = await checkDsoAccess(currentUser.id, existingDoctor.dso_id);
        if (!hasAccess || !hasWriteAccess(role)) {
            return NextResponse.json(
                { error: 'Write access required to update doctor' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { name, email, phone, status, notes } = body;

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
        // Require authentication
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const currentUser = authResult.user;

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

        // Verify user has admin access to delete (only admins can delete)
        const { hasAccess, role } = await checkDsoAccess(currentUser.id, existingDoctor.dso_id);
        if (!hasAccess || role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required to delete doctor' },
                { status: 403 }
            );
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
