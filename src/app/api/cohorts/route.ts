import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgDsoAccess } from '@/lib/auth';
import { Cohort, CohortStatus } from '@/lib/db/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dsoId = searchParams.get('dso_id');

        if (!dsoId) {
            return NextResponse.json(
                { error: 'dso_id is required' },
                { status: 400 }
            );
        }

        const accessResult = await requireOrgDsoAccess(request, dsoId);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const { data: cohorts, error: cohortsError } = await supabaseAdmin
            .from('cohorts')
            .select('*')
            .eq('dso_id', dsoId)
            .order('created_at');

        if (cohortsError) throw cohortsError;

        if (!cohorts || cohorts.length === 0) {
            return NextResponse.json({ cohorts: [] });
        }

        const cohortIds = cohorts.map((cohort) => cohort.id);
        const { data: tables, error: tablesError } = await supabaseAdmin
            .from('data_tables')
            .select('id, cohort_id')
            .eq('client_id', dsoId)
            .in('cohort_id', cohortIds);

        if (tablesError) throw tablesError;

        const attendeeCountsByCohortId: Record<string, number> = {};

        if (tables && tables.length > 0) {
            const rowCounts = await Promise.all(
                tables.map(async (table) => {
                    const { count, error } = await supabaseAdmin
                        .from('data_rows')
                        .select('*', { count: 'exact', head: true })
                        .eq('table_id', table.id);

                    if (error) throw error;

                    return {
                        cohortId: table.cohort_id as string,
                        count: count || 0,
                    };
                })
            );

            for (const rowCount of rowCounts) {
                attendeeCountsByCohortId[rowCount.cohortId] = (attendeeCountsByCohortId[rowCount.cohortId] || 0) + rowCount.count;
            }
        }

        const cohortsWithCounts = cohorts.map((cohort) => ({
            ...cohort,
            attendee_count: attendeeCountsByCohortId[cohort.id] || 0,
        }));

        return NextResponse.json({ cohorts: cohortsWithCounts });
    } catch (error) {
        console.error('Error fetching cohorts:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            dso_id,
            name,
            start_date,
            status,
        }: {
            dso_id?: string;
            name?: string;
            start_date?: string | null;
            status?: CohortStatus;
        } = body;

        if (!dso_id) {
            return NextResponse.json(
                { error: 'dso_id is required' },
                { status: 400 }
            );
        }

        if (!name?.trim()) {
            return NextResponse.json(
                { error: 'name is required' },
                { status: 400 }
            );
        }

        const accessResult = await requireOrgDsoAccess(request, dso_id, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        const { data: cohort, error } = await supabaseAdmin
            .from('cohorts')
            .insert({
                dso_id,
                name: name.trim(),
                start_date: start_date || null,
                status: status || 'active',
            })
            .select('*')
            .single();

        if (error) throw error;

        const responseCohort: Cohort = {
            ...cohort,
            attendee_count: 0,
        };

        return NextResponse.json({ cohort: responseCohort }, { status: 201 });
    } catch (error) {
        console.error('Error creating cohort:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
