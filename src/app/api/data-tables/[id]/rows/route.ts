import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Verify table exists
        const { data: table, error: tableError } = await supabaseAdmin
            .from('data_tables')
            .select('id')
            .eq('id', id)
            .single();

        if (tableError || !table) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        // Fetch rows
        const { data: rows, error: rowsError } = await supabaseAdmin
            .from('data_rows')
            .select('*')
            .eq('table_id', id)
            .order('created_at');

        if (rowsError) throw rowsError;

        return NextResponse.json({ rows: rows || [] });
    } catch (error) {
        console.error('Error fetching rows:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { data } = body;

        // Verify table exists
        const { data: table, error: tableError } = await supabaseAdmin
            .from('data_tables')
            .select('id')
            .eq('id', id)
            .single();

        if (tableError || !table) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        // Create row
        const { data: row, error: insertError } = await supabaseAdmin
            .from('data_rows')
            .insert({
                table_id: id,
                data: data || {},
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return NextResponse.json({ row }, { status: 201 });
    } catch (error) {
        console.error('Error creating row:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
