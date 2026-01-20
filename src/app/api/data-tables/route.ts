import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { mockDataTemplates } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('client_id');

        if (!clientId) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        // TODO: Re-enable auth check once SSR cookie handling is fixed
        // const accessResult = await requireDsoAccess(request, clientId);
        // if ('response' in accessResult) {
        //     return accessResult.response;
        // }

        // Fetch tables from Supabase
        const { data: tables, error: tablesError } = await supabaseAdmin
            .from('data_tables')
            .select('*')
            .eq('client_id', clientId)
            .order('order_index');

        if (tablesError) throw tablesError;

        // Fetch columns and row counts for each table
        const tablesWithMeta = await Promise.all(
            (tables || []).map(async (table) => {
                const { data: columns } = await supabaseAdmin
                    .from('data_columns')
                    .select('*')
                    .eq('table_id', table.id)
                    .order('order_index');

                const { count } = await supabaseAdmin
                    .from('data_rows')
                    .select('*', { count: 'exact', head: true })
                    .eq('table_id', table.id);

                return {
                    ...table,
                    columns: columns || [],
                    row_count: count || 0,
                };
            })
        );

        return NextResponse.json({ tables: tablesWithMeta });
    } catch (error) {
        console.error('Error fetching data tables:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { client_id, name, template_id } = body;

        if (!client_id) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        if (!name && !template_id) {
            return NextResponse.json(
                { error: 'name or template_id is required' },
                { status: 400 }
            );
        }

        // TODO: Re-enable auth check once SSR cookie handling is fixed
        // const accessResult = await requireDsoAccess(request, client_id, true);
        // if ('response' in accessResult) {
        //     return accessResult.response;
        // }

        // Get template if provided
        const template = template_id ? mockDataTemplates.find(t => t.id === template_id) : undefined;

        // Count existing tables for order_index
        const { count: existingCount } = await supabaseAdmin
            .from('data_tables')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', client_id);

        // Build time_tracking config from template
        let timeTracking = null;
        if (template?.time_tracking?.enabled) {
            timeTracking = {
                enabled: true,
                frequency: template.time_tracking.frequency,
                metrics: template.time_tracking.metrics.map((m, idx) => ({
                    id: `metric-${Date.now()}-${idx}`,
                    name: m.name,
                    type: m.type,
                })),
            };
        }

        // Create table in Supabase
        const { data: table, error: tableError } = await supabaseAdmin
            .from('data_tables')
            .insert({
                client_id,
                name: template?.name || name,
                description: template?.description || null,
                icon: template?.icon || 'table',
                color: template?.color || 'blue',
                is_template: !!template_id,
                template_id: template_id || null,
                order_index: existingCount || 0,
                time_tracking: timeTracking,
            })
            .select()
            .single();

        if (tableError) throw tableError;

        // Create columns from template
        if (template) {
            const columnsToInsert = template.columns.map((col, index) => ({
                table_id: table.id,
                name: col.name,
                type: col.type,
                config: col.config || {},
                is_required: col.is_required || false,
                is_primary: col.is_primary || false,
                width: 150,
                order_index: index,
            }));

            const { error: columnsError } = await supabaseAdmin
                .from('data_columns')
                .insert(columnsToInsert);

            if (columnsError) {
                console.error('Error creating columns:', columnsError);
            }
        }

        // Fetch columns for response
        const { data: columns } = await supabaseAdmin
            .from('data_columns')
            .select('*')
            .eq('table_id', table.id)
            .order('order_index');

        return NextResponse.json({
            table: {
                ...table,
                columns: columns || [],
                row_count: 0,
            }
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating data table:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
