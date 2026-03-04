import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth, getUserOrg } from '@/lib/auth';
import { computeClientMetrics } from '@/lib/attendee-tracker';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Try to get user from session, fall back to user_id param
        const authResult = await requireAuth(request);
        let userId: string;
        if ('response' in authResult) {
            // Session auth failed, try user_id param as fallback
            const userIdParam = searchParams.get('user_id');
            if (!userIdParam) {
                return NextResponse.json({ clients: [] });
            }
            userId = userIdParam;
        } else {
            userId = authResult.user.id;
        }

        // Get user's org (org boundary check for enumeration routes)
        const orgInfo = await getUserOrg(userId);
        if (!orgInfo) {
            return NextResponse.json({ clients: [] });
        }

        // Get DSOs that the user has access to, filtered by org
        const { data: accessRecords, error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id, dsos!inner(org_id)')
            .eq('user_id', userId)
            .eq('dsos.org_id', orgInfo.orgId);

        if (accessError) throw accessError;

        // If user has no access to any DSOs within their org, return empty array
        if (!accessRecords || accessRecords.length === 0) {
            return NextResponse.json({ clients: [] });
        }

        const dsoIds = accessRecords.map(r => r.dso_id);

        // Fetch only DSOs the user has access to (no doctors join needed)
        const { data: clients, error } = await supabaseAdmin
            .from('dsos')
            .select('*')
            .in('id', dsoIds)
            .or('archived.is.null,archived.eq.false');

        if (error) throw error;

        // Compute metrics from data_tables for each client in parallel
        const clientsWithMetrics = await Promise.all(
            (clients || []).map(async (client) => {
                const metrics = await computeClientMetrics(client.id);
                return {
                    ...client,
                    metrics: {
                        client_id: client.id,
                        ...metrics,
                    },
                };
            })
        );

        return NextResponse.json({ clients: clientsWithMetrics });
    } catch (error) {
        console.error('Error fetching clients overview:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
