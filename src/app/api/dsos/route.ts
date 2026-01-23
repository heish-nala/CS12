import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const includeArchived = searchParams.get('include_archived') === 'true';

        // Try to get user from session, fall back to user_id param
        const authResult = await requireAuth(request);
        let userId: string;
        if ('response' in authResult) {
            // Session auth failed, try user_id param as fallback
            const userIdParam = searchParams.get('user_id');
            if (!userIdParam) {
                return authResult.response;
            }
            userId = userIdParam;
        } else {
            userId = authResult.user.id;
        }

        // Get DSOs that the user has access to
        const { data: accessRecords, error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id')
            .eq('user_id', userId);

        if (accessError) throw accessError;

        if (!accessRecords || accessRecords.length === 0) {
            return NextResponse.json({ dsos: [], archivedDsos: [] });
        }

        const dsoIds = accessRecords.map(r => r.dso_id);

        // Try to get DSOs with archived filter, fall back to without if column doesn't exist
        let activeDsos: any[] = [];
        let archivedDsos: any[] = [];

        // First try with archived filter
        const { data: activeDsosWithFilter, error: activeError } = await supabaseAdmin
            .from('dsos')
            .select('*')
            .in('id', dsoIds)
            .or('archived.is.null,archived.eq.false')
            .order('name');

        // Check if error is due to missing 'archived' column
        if (activeError && (activeError as any).code === '42703') {
            // Column doesn't exist, fetch without filter
            const { data: allDsos, error: fallbackError } = await supabaseAdmin
                .from('dsos')
                .select('*')
                .in('id', dsoIds)
                .order('name');

            if (fallbackError) throw fallbackError;
            activeDsos = allDsos || [];
            // No archived DSOs since column doesn't exist
            archivedDsos = [];
        } else if (activeError) {
            throw activeError;
        } else {
            activeDsos = activeDsosWithFilter || [];

            // Get archived DSOs if requested and column exists
            if (includeArchived) {
                const { data: archived, error: archivedError } = await supabaseAdmin
                    .from('dsos')
                    .select('*')
                    .in('id', dsoIds)
                    .eq('archived', true)
                    .order('name');

                // Ignore error if column doesn't exist
                if (!archivedError) {
                    archivedDsos = archived || [];
                }
            }
        }

        return NextResponse.json({
            dsos: activeDsos,
            archivedDsos: archivedDsos
        });
    } catch (error) {
        console.error('Error fetching DSOs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name } = body;

        // Require authentication and get user from session
        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;
        }
        const user_id = authResult.user.id;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        // Create the DSO
        const { data, error } = await supabaseAdmin
            .from('dsos')
            .insert({ name })
            .select()
            .single();

        if (error) throw error;

        // Create user access record (admin role for creator)
        // This MUST succeed for the user to see the client
        const { error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .insert({
                user_id: user_id,
                dso_id: data.id,
                role: 'admin'
            });

        if (accessError) {
            console.error('Error creating user access:', accessError);
            // Rollback: delete the DSO since user won't be able to access it
            await supabaseAdmin
                .from('dsos')
                .delete()
                .eq('id', data.id);

            return NextResponse.json(
                { error: 'Failed to create client access. Please try again.' },
                { status: 500 }
            );
        }

        return NextResponse.json({ dso: data }, { status: 201 });
    } catch (error) {
        console.error('Error creating DSO:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, archived } = body;

        // Require authentication and get user from session
        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;
        }
        const user_id = authResult.user.id;

        if (!id) {
            return NextResponse.json(
                { error: 'id is required' },
                { status: 400 }
            );
        }

        // Verify user has access to this DSO
        const { data: access, error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .select('role')
            .eq('user_id', user_id)
            .eq('dso_id', id)
            .single();

        if (accessError || !access) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // Update the DSO
        const { data, error } = await supabaseAdmin
            .from('dsos')
            .update({ archived: archived ?? false })
            .eq('id', id)
            .select()
            .single();

        // Check if error is due to missing 'archived' column
        if (error && (error as any).code === '42703') {
            return NextResponse.json(
                { error: 'Archive feature not available. Please run database migration first.' },
                { status: 400 }
            );
        }

        if (error) throw error;

        return NextResponse.json({ dso: data });
    } catch (error) {
        console.error('Error updating DSO:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
