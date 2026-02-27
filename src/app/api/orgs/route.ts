import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth';
import { generateOrgSlug } from '@/lib/org-utils';

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;
        }
        const { user } = authResult;

        const { data, error } = await supabaseAdmin
            .from('org_members')
            .select('role, organizations(*)')
            .eq('user_id', user.id);

        if (error) throw error;

        const orgs = (data || []).map((row: any) => ({
            ...row.organizations,
            role: row.role,
        }));

        return NextResponse.json({ orgs });
    } catch (error) {
        console.error('Error fetching orgs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;
        }
        const { user } = authResult;

        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
            return NextResponse.json(
                { error: 'Name is required and must be between 1 and 100 characters' },
                { status: 400 }
            );
        }

        const slug = generateOrgSlug(name.trim());

        if (!slug) {
            return NextResponse.json(
                { error: 'Organization name must contain at least one alphanumeric character' },
                { status: 400 }
            );
        }

        // Insert the organization
        const { data, error } = await supabaseAdmin
            .from('organizations')
            .insert({ name: name.trim(), slug, created_by: user.id })
            .select()
            .single();

        if (error) {
            if ((error as any).code === '23505') {
                return NextResponse.json(
                    { error: 'An organization with this name already exists. Please choose a different name.' },
                    { status: 409 }
                );
            }
            throw error;
        }

        // Insert creator as owner in org_members
        const { error: memberError } = await supabaseAdmin
            .from('org_members')
            .insert({ org_id: data.id, user_id: user.id, role: 'owner' });

        if (memberError) {
            console.error('Error creating org membership:', memberError);
            // Rollback: delete the organization since the creator can't be added
            await supabaseAdmin
                .from('organizations')
                .delete()
                .eq('id', data.id);

            return NextResponse.json(
                { error: 'Failed to create organization membership. Please try again.' },
                { status: 500 }
            );
        }

        return NextResponse.json({ org: data }, { status: 201 });
    } catch (error) {
        console.error('Error creating org:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
