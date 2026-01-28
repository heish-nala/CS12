import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireDsoAccessWithFallback, checkDsoAccess } from '@/lib/auth';

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

        // Require access to the DSO
        const accessResult = await requireDsoAccessWithFallback(request, doctor.dso_id);
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
        const body = await request.json();
        const { periodNumber, updates, user_id } = body;

        // Get doctor to find their DSO for auth
        const { data: doctor } = await supabaseAdmin
            .from('doctors')
            .select('dso_id')
            .eq('id', id)
            .single();

        if (!doctor) {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }

        // Require write access to the DSO
        const accessResult = await requireDsoAccessWithFallback(request, doctor.dso_id);
        if ('response' in accessResult) {
            // Try user_id fallback
            if (!user_id) {
                return accessResult.response;
            }
            const { hasAccess, role } = await checkDsoAccess(user_id, doctor.dso_id);
            if (!hasAccess || (role !== 'admin' && role !== 'manager')) {
                return NextResponse.json({ error: 'Write access required' }, { status: 403 });
            }
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
