import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireDsoAccess, requireDsoAccessWithFallback } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        // Pagination params with sensible defaults
        const limit = parseInt(searchParams.get('limit') || '500'); // Default 500 rows
        const offset = parseInt(searchParams.get('offset') || '0');

        // Fetch table from Supabase
        const { data: table, error: tableError } = await supabaseAdmin
            .from('data_tables')
            .select('*')
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

        // OPTIMIZATION: Fetch columns and rows in PARALLEL
        const [columnsResult, rowsResult, countResult] = await Promise.all([
            // Fetch columns
            supabaseAdmin
                .from('data_columns')
                .select('*')
                .eq('table_id', id)
                .order('order_index'),

            // Fetch rows with pagination
            supabaseAdmin
                .from('data_rows')
                .select('*')
                .eq('table_id', id)
                .order('created_at')
                .range(offset, offset + limit - 1),

            // Get total count for pagination info
            supabaseAdmin
                .from('data_rows')
                .select('*', { count: 'exact', head: true })
                .eq('table_id', id),
        ]);

        return NextResponse.json({
            table: {
                ...table,
                columns: columnsResult.data || [],
                rows: rowsResult.data || [],
            },
            pagination: {
                limit,
                offset,
                total: countResult.count || 0,
                hasMore: (offset + limit) < (countResult.count || 0),
            }
        });
    } catch (error) {
        console.error('Error fetching data table:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Get current table to check frequency change and get client_id
        const { data: currentTable } = await supabaseAdmin
            .from('data_tables')
            .select('time_tracking, client_id')
            .eq('id', id)
            .single();

        if (!currentTable) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        // Require write access to the client/DSO (with user_id fallback)
        const accessResult = await requireDsoAccessWithFallback(request, currentTable.client_id, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const currentFrequency = currentTable.time_tracking?.frequency;
        const newFrequency = body.time_tracking?.frequency;

        // If frequency is changing, clear all existing periods
        if (currentFrequency && newFrequency && currentFrequency !== newFrequency) {
            await supabaseAdmin
                .from('period_data')
                .delete()
                .eq('table_id', id);
        }

        // Update table
        const { data: table, error: updateError } = await supabaseAdmin
            .from('data_tables')
            .update({
                ...body,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        return NextResponse.json({ table });
    } catch (error) {
        console.error('Error updating data table:', error);
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

        // Get table to check client_id
        const { data: table } = await supabaseAdmin
            .from('data_tables')
            .select('client_id')
            .eq('id', id)
            .single();

        if (!table) {
            return NextResponse.json(
                { error: 'Table not found' },
                { status: 404 }
            );
        }

        // Require write access to the client/DSO (with user_id fallback from query params)
        const accessResult = await requireDsoAccessWithFallback(request, table.client_id, true);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        // Delete rows first (foreign key constraint)
        await supabaseAdmin
            .from('data_rows')
            .delete()
            .eq('table_id', id);

        // Delete columns
        await supabaseAdmin
            .from('data_columns')
            .delete()
            .eq('table_id', id);

        // Delete period data if exists
        await supabaseAdmin
            .from('period_data')
            .delete()
            .eq('table_id', id);

        // Delete table
        const { error: deleteError } = await supabaseAdmin
            .from('data_tables')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting data table:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
