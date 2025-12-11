import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

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
        const { periodNumber, updates } = body;

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
