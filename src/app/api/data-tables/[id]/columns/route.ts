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
