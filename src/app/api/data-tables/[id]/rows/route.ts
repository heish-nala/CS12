import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Verify table exists and get client_id
        const { data: table, error: tableError } = await supabaseAdmin
            .from('data_tables')
            .select('id, client_id')
            .eq('id', id)
            .single();

        if (tableError || !table) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        // TODO: Re-enable auth check once SSR cookie handling is fixed
        // const accessResult = await requireDsoAccess(request, table.client_id);
        // if ('response' in accessResult) {
        //     return accessResult.response;
        // }

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

        // Verify table exists and get client_id
        const { data: table, error: tableError } = await supabaseAdmin
            .from('data_tables')
            .select('id, client_id')
            .eq('id', id)
            .single();

        if (tableError || !table) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        // TODO: Re-enable auth check once SSR cookie handling is fixed
        // const accessResult = await requireDsoAccess(request, table.client_id, true);
        // if ('response' in accessResult) {
        //     return accessResult.response;
        // }

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
