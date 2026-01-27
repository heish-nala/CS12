import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireDsoAccess, requireDsoAccessWithFallback } from '@/lib/auth';

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

        // Require access to the client/DSO (with user_id param fallback for GET)
        const accessResult = await requireDsoAccessWithFallback(request, table.client_id);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        // Fetch columns
        const { data: columns, error: columnsError } = await supabaseAdmin
            .from('data_columns')
            .select('*')
            .eq('table_id', id)
            .order('order_index');

        if (columnsError) throw columnsError;

        return NextResponse.json({ columns: columns || [] });
    } catch (error) {
        console.error('Error fetching columns:', error);
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
        const { name, type, config } = body;

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

        // Require write access to the client/DSO (with user_id fallback)
        const accessResult = await requireDsoAccessWithFallback(request, table.client_id, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        if (!name) {
            return NextResponse.json(
                { error: 'name is required' },
                { status: 400 }
            );
        }

        // Get existing column count for order_index
        const { count: existingCount } = await supabaseAdmin
            .from('data_columns')
            .select('*', { count: 'exact', head: true })
            .eq('table_id', id);

        // Create column
        const { data: column, error: insertError } = await supabaseAdmin
            .from('data_columns')
            .insert({
                table_id: id,
                name,
                type: type || 'text',
                config: config || {},
                is_required: false,
                is_primary: existingCount === 0,
                width: 150,
                order_index: existingCount || 0,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return NextResponse.json({ column }, { status: 201 });
    } catch (error) {
        console.error('Error creating column:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
