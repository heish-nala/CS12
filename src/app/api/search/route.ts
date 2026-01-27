import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';

export interface SearchResult {
    id: string;
    type: 'client' | 'doctor' | 'row';
    title: string;
    subtitle?: string;
    href: string;
    metadata?: Record<string, string>;
}

export async function GET(request: NextRequest) {
    try {
        // Require authentication
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const currentUser = authResult.user;

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.toLowerCase() || '';

        if (!query || query.length < 2) {
            return NextResponse.json({ results: [] });
        }

        // Get user's accessible DSOs first
        const { data: userAccess } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id')
            .eq('user_id', currentUser.id);

        const accessibleDsoIds = userAccess?.map(a => a.dso_id) || [];

        if (accessibleDsoIds.length === 0) {
            return NextResponse.json({ results: [] });
        }

        const results: SearchResult[] = [];

        // Search clients (DSOs) - only accessible ones
        const { data: clients } = await supabaseAdmin
            .from('dsos')
            .select('id, name, industry, contact_name, contact_email')
            .in('id', accessibleDsoIds)
            .or(`name.ilike.%${query}%,industry.ilike.%${query}%,contact_name.ilike.%${query}%,contact_email.ilike.%${query}%`)
            .limit(10);

        clients?.forEach((client) => {
            results.push({
                id: client.id,
                type: 'client',
                title: client.name,
                subtitle: client.industry,
                href: `/clients/${client.id}`,
            });
        });

        // Search doctors - only from accessible DSOs
        const { data: doctors } = await supabaseAdmin
            .from('doctors')
            .select('id, name, email, notes, status, dso_id, dsos(name)')
            .in('dso_id', accessibleDsoIds)
            .or(`name.ilike.%${query}%,email.ilike.%${query}%,notes.ilike.%${query}%`)
            .limit(10);

        doctors?.forEach((doctor: any) => {
            results.push({
                id: doctor.id,
                type: 'doctor',
                title: doctor.name,
                subtitle: doctor.dsos?.name,
                href: `/clients/${doctor.dso_id}`,
                metadata: { status: doctor.status },
            });
        });

        // Search data table rows - only from accessible DSOs
        // First get data tables from accessible clients
        const { data: accessibleTables } = await supabaseAdmin
            .from('data_tables')
            .select('id')
            .in('client_id', accessibleDsoIds);

        const accessibleTableIds = accessibleTables?.map(t => t.id) || [];

        if (accessibleTableIds.length > 0) {
            const { data: rows } = await supabaseAdmin
                .from('data_rows')
                .select('id, table_id, data, data_tables(name, client_id)')
                .in('table_id', accessibleTableIds)
                .limit(20);

            rows?.forEach((row: any) => {
                const dataValues = Object.entries(row.data || {});
                for (const [, value] of dataValues) {
                    if (value && String(value).toLowerCase().includes(query)) {
                        results.push({
                            id: row.id,
                            type: 'row',
                            title: String(value),
                            subtitle: row.data_tables?.name || 'Table',
                            href: `/clients/${row.data_tables?.client_id || '1'}?table=${row.table_id}&row=${row.id}`,
                        });
                        break;
                    }
                }
            });
        }

        // Limit results
        const limitedResults = results.slice(0, 20);

        return NextResponse.json({ results: limitedResults });
    } catch (error) {
        console.error('Error searching:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
