import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth, requireOrgDsoAccess, getUserOrg } from '@/lib/auth';

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

        // Get user's org to filter DSOs to the correct org (prevents cross-org enumeration)
        const orgInfo = await getUserOrg(userId);
        if (!orgInfo) {
            return NextResponse.json({ dsos: [], archivedDsos: [] });
        }

        // Get DSOs that the user has access to, filtered to their org
        const { data: accessRecords, error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id, role, dsos!inner(*)')
            .eq('user_id', userId)
            .eq('dsos.org_id', orgInfo.orgId);

        if (accessError) throw accessError;

        if (!accessRecords || accessRecords.length === 0) {
            return NextResponse.json({ dsos: [], archivedDsos: [] });
        }

        const dsosWithRoles = accessRecords
            .map((record: any) => ({
                ...record.dsos,
                access_role: record.role,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const activeDsos = dsosWithRoles.filter((dso: any) => dso.archived !== true);
        const archivedDsos = includeArchived
            ? dsosWithRoles.filter((dso: any) => dso.archived === true)
            : [];

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
        const { name, user_id: bodyUserId } = body;

        // Try to get user from session, fall back to user_id from body
        const authResult = await requireAuth(request);
        let user_id: string;
        if ('response' in authResult) {
            // Session auth failed, try user_id from body as fallback
            if (!bodyUserId) {
                return authResult.response;
            }
            user_id = bodyUserId;
        } else {
            user_id = authResult.user.id;
        }

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        // Look up user's org (for v1, user has one org)
        const { data: membership, error: memberError } = await supabaseAdmin
            .from('org_members')
            .select('org_id')
            .eq('user_id', user_id)
            .limit(1)
            .single();

        if (memberError || !membership) {
            return NextResponse.json(
                { error: 'You must belong to an organization to create a client' },
                { status: 400 }
            );
        }

        // Create the DSO
        const { data, error } = await supabaseAdmin
            .from('dsos')
            .insert({ name, org_id: membership.org_id })
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
        const { id, archived, name } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'id is required' },
                { status: 400 }
            );
        }

        // Verify user has org + DSO access (with user_id fallback from body)
        const accessResult = await requireOrgDsoAccess(request, id, true, body);
        if ('response' in accessResult) {
            return accessResult.response;
        }

        // Build update object with only provided fields
        const updateData: { name?: string; archived?: boolean } = {};
        if (name !== undefined) updateData.name = name;
        if (archived !== undefined) updateData.archived = archived;

        // Update the DSO
        const { data, error } = await supabaseAdmin
            .from('dsos')
            .update(updateData)
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
