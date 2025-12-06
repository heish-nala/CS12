import { NextRequest, NextResponse } from 'next/server';
import {
    mockClients,
    mockDoctors,
    mockDataRows,
    mockDataTables,
    mockDataColumns,
    getDSOById,
} from '@/lib/mock-data';

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
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.toLowerCase() || '';

        if (!query || query.length < 2) {
            return NextResponse.json({ results: [] });
        }

        const results: SearchResult[] = [];

        // Search clients
        mockClients.forEach((client) => {
            if (
                client.name.toLowerCase().includes(query) ||
                client.industry?.toLowerCase().includes(query) ||
                client.contact_name?.toLowerCase().includes(query) ||
                client.contact_email?.toLowerCase().includes(query)
            ) {
                results.push({
                    id: client.id,
                    type: 'client',
                    title: client.name,
                    subtitle: client.industry,
                    href: `/clients/${client.id}`,
                });
            }
        });

        // Search doctors
        mockDoctors.forEach((doctor) => {
            if (
                doctor.name.toLowerCase().includes(query) ||
                doctor.email?.toLowerCase().includes(query) ||
                doctor.notes?.toLowerCase().includes(query)
            ) {
                const dso = getDSOById(doctor.dso_id);
                results.push({
                    id: doctor.id,
                    type: 'doctor',
                    title: doctor.name,
                    subtitle: dso?.name,
                    href: `/clients/${doctor.dso_id}`,
                    metadata: { status: doctor.status },
                });
            }
        });

        // Search data table rows
        mockDataRows.forEach((row) => {
            const table = mockDataTables.find(t => t.id === row.table_id);
            const columns = mockDataColumns.filter(c => c.table_id === row.table_id);

            // Search through all row data values
            const dataValues = Object.entries(row.data || {});
            for (const [columnId, value] of dataValues) {
                if (value && String(value).toLowerCase().includes(query)) {
                    const column = columns.find(c => c.id === columnId);
                    results.push({
                        id: row.id,
                        type: 'row',
                        title: String(value),
                        subtitle: `${table?.name || 'Table'} - ${column?.name || 'Field'}`,
                        href: `/clients/${table?.client_id || '1'}?table=${row.table_id}&row=${row.id}`,
                    });
                    break; // Only add the row once
                }
            }
        });

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
