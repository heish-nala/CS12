import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireOrgAccess } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const authResult = await requireOrgAccess(request, id);
        if ('response' in authResult) {
            return authResult.response;
        }
        const { role } = authResult;

        const { data, error } = await supabaseAdmin
            .from('organizations')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: 'Organization not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ org: data, role });
    } catch (error) {
        console.error('Error fetching org:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Only owners and admins can rename
        const authResult = await requireOrgAccess(request, id, true);
        if ('response' in authResult) {
            return authResult.response;
        }

        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
            return NextResponse.json(
                { error: 'Name is required and must be between 1 and 100 characters' },
                { status: 400 }
            );
        }

        // Only update name — slug is a stable identifier and should not change
        const { data, error } = await supabaseAdmin
            .from('organizations')
            .update({ name: name.trim() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ org: data });
    } catch (error) {
        console.error('Error updating org:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
