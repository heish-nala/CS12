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

// Fixed columns for attendee list
const ATTENDEE_LIST_COLUMNS = [
    { name: 'Name', type: 'text', is_primary: true, is_required: true },
    { name: 'Email', type: 'email' },
    { name: 'Phone', type: 'phone' },
    { name: 'Blueprint', type: 'percentage', config: { default_value: 0 } },
    { name: 'Status', type: 'status', config: { options: [
        { id: 's1', value: 'not_started', label: 'Not Started', color: 'gray', group: 'todo' },
        { id: 's2', value: 'active', label: 'Active', color: 'blue', group: 'in_progress' },
        { id: 's3', value: 'at_risk', label: 'At Risk', color: 'orange', group: 'in_progress' },
        { id: 's4', value: 'completed', label: 'Completed', color: 'green', group: 'complete' },
        { id: 's5', value: 'inactive', label: 'Inactive', color: 'red', group: 'complete' },
    ] } },
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { client_id, name, template_id, type } = body;

        if (!client_id) {
            return NextResponse.json(
                { error: 'client_id is required' },
                { status: 400 }
            );
        }

        // Support attendee_list type, template_id, or custom name
        const isAttendeeList = type === 'attendee_list';
        if (!name && !template_id && !isAttendeeList) {
            return NextResponse.json(
                { error: 'name, template_id, or type is required' },
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

        // Determine table properties based on type
        const tableName = isAttendeeList ? 'Attendee List' : (template?.name || name);
        const tableIcon = isAttendeeList ? 'users' : (template?.icon || 'table');
        const tableColor = isAttendeeList ? 'blue' : (template?.color || 'blue');

        // Create table in Supabase
        const { data: table, error: tableError } = await supabaseAdmin
            .from('data_tables')
            .insert({
                client_id,
                name: tableName,
                description: template?.description || (isAttendeeList ? 'Track attendees with Name, Email, Phone, Blueprint, and Status' : null),
                icon: tableIcon,
                color: tableColor,
                is_template: !!template_id || isAttendeeList,
                template_id: template_id || (isAttendeeList ? 'attendee_list' : null),
                order_index: existingCount || 0,
                time_tracking: timeTracking,
            })
            .select()
            .single();

        if (tableError) throw tableError;

        // Determine which columns to create
        const columnsSource = isAttendeeList ? ATTENDEE_LIST_COLUMNS : template?.columns;

        // Create columns from template or attendee list
        if (columnsSource) {
            const columnsToInsert = columnsSource.map((col, index) => ({
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
