import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireDsoAccessWithFallback } from '@/lib/auth';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    try {
        const { id, rowId } = await params;
        const body = await request.json();
        const { data } = body;

        // Get table to check client_id for auth
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

        // Require write access to the client/DSO (with user_id fallback)
        const accessResult = await requireDsoAccessWithFallback(request, table.client_id, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        // Get existing row data first
        const { data: existingRow, error: fetchError } = await supabaseAdmin
            .from('data_rows')
            .select('data')
            .eq('id', rowId)
            .single();

        if (fetchError || !existingRow) {
            return NextResponse.json(
                { error: 'Row not found' },
                { status: 404 }
            );
        }

        // Merge existing data with new data
        const mergedData = { ...existingRow.data, ...data };

        // Update row
        const { data: row, error: updateError } = await supabaseAdmin
            .from('data_rows')
            .update({
                data: mergedData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', rowId)
            .select()
            .single();

        if (updateError) throw updateError;

        return NextResponse.json({ row });
    } catch (error) {
        console.error('Error updating row:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    try {
        const { id, rowId } = await params;

        // Get table to check client_id for auth
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

        // Delete associated period data first
        await supabaseAdmin
            .from('period_data')
            .delete()
            .eq('row_id', rowId);

        // Delete row
        const { error: deleteError } = await supabaseAdmin
            .from('data_rows')
            .delete()
            .eq('id', rowId);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting row:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
