import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; columnId: string }> }
) {
    try {
        const { columnId } = await params;
        const body = await request.json();

        // Update column
        const { data: column, error: updateError } = await supabaseAdmin
            .from('data_columns')
            .update({
                ...body,
                updated_at: new Date().toISOString(),
            })
            .eq('id', columnId)
            .select()
            .single();

        if (updateError) {
            if (updateError.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Column not found' },
                    { status: 404 }
                );
            }
            throw updateError;
        }

        return NextResponse.json({ column });
    } catch (error) {
        console.error('Error updating column:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; columnId: string }> }
) {
    try {
        const { id, columnId } = await params;

        // Get column info first to remove data from rows
        const { data: column } = await supabaseAdmin
            .from('data_columns')
            .select('table_id')
            .eq('id', columnId)
            .single();

        if (!column) {
            return NextResponse.json(
                { error: 'Column not found' },
                { status: 404 }
            );
        }

        // Delete column
        const { error: deleteError } = await supabaseAdmin
            .from('data_columns')
            .delete()
            .eq('id', columnId);

        if (deleteError) throw deleteError;

        // Note: Row data cleanup would require updating each row's JSONB data
        // This is optional since the column no longer exists

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting column:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
