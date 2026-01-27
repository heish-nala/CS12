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
        const { data, user_id: bodyUserId } = body;

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

        // Require write access to the client/DSO (with user_id body fallback)
        const accessResult = await requireDsoAccessWithFallback(request, table.client_id, true);
        if ('response' in accessResult) {
            // If no session and no user_id param, try body user_id
            if (bodyUserId) {
                // Verify user has access via body user_id
                const { data: access } = await supabaseAdmin
                    .from('user_dso_access')
                    .select('role')
                    .eq('user_id', bodyUserId)
                    .eq('dso_id', table.client_id)
                    .single();

                if (!access || (access.role !== 'admin' && access.role !== 'manager')) {
                    return accessResult.response;
                }
            } else {
                return accessResult.response;
            }
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
