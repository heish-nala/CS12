import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

// Phone number formatting helper
function formatPhoneNumber(input: string): string {
    if (!input) return '';

    // Extract only digits
    let digits = input.replace(/\D/g, '');

    if (digits.length === 0) return input; // Return original if no digits

    // Strip leading 1 for US numbers
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }

    // US/Canada format (10 digits): (XXX) XXX-XXXX
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // International or other formats
    if (digits.length > 10) {
        return '+' + digits.replace(/(\d{1,3})(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4').trim();
    }

    // Partial numbers - return original
    return input;
}

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('client_id');

        if (!clientId) {
            return NextResponse.json({ error: 'client_id required' }, { status: 400 });
        }

        // Get all tables for this client
        const { data: tables, error: tablesError } = await supabase
            .from('data_tables')
            .select('id, name')
            .eq('client_id', clientId);

        if (tablesError) throw tablesError;

        let totalUpdated = 0;

        for (const table of tables || []) {
            // Get phone columns for this table
            const { data: columns, error: colError } = await supabase
                .from('data_columns')
                .select('id')
                .eq('table_id', table.id)
                .eq('type', 'phone');

            if (colError) throw colError;
            if (!columns || columns.length === 0) continue;

            // Get all rows for this table
            const { data: rows, error: rowsError } = await supabase
                .from('data_rows')
                .select('id, data')
                .eq('table_id', table.id);

            if (rowsError) throw rowsError;

            // Update each row's phone numbers
            for (const row of rows || []) {
                let updated = false;
                const newData = { ...row.data };

                for (const col of columns) {
                    const currentValue = newData[col.id];
                    if (currentValue && typeof currentValue === 'string') {
                        const formatted = formatPhoneNumber(currentValue);
                        if (formatted !== currentValue) {
                            newData[col.id] = formatted;
                            updated = true;
                        }
                    }
                }

                if (updated) {
                    await supabase
                        .from('data_rows')
                        .update({ data: newData })
                        .eq('id', row.id);
                    totalUpdated++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Formatted ${totalUpdated} phone numbers`,
            debug: {
                tablesFound: tables?.length || 0,
            }
        });
    } catch (error) {
        console.error('Error formatting phone numbers:', error);
        return NextResponse.json(
            { error: 'Failed to format phone numbers' },
            { status: 500 }
        );
    }
}
