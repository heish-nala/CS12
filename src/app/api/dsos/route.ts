import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');

        if (!userId) {
            return NextResponse.json(
                { error: 'user_id is required' },
                { status: 400 }
            );
        }

        // Get DSOs that the user has access to
        const { data: accessRecords, error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id')
            .eq('user_id', userId);

        if (accessError) throw accessError;

        if (!accessRecords || accessRecords.length === 0) {
            return NextResponse.json({ dsos: [] });
        }

        const dsoIds = accessRecords.map(r => r.dso_id);

        const { data: dsos, error } = await supabaseAdmin
            .from('dsos')
            .select('*')
            .in('id', dsoIds)
            .order('name');

        if (error) throw error;

        return NextResponse.json({ dsos: dsos || [] });
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
        const { name, user_id } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        if (!user_id) {
            return NextResponse.json(
                { error: 'user_id is required' },
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
        const { error: accessError } = await supabaseAdmin
            .from('user_dso_access')
            .insert({
                user_id: user_id,
                dso_id: data.id,
                role: 'admin'
            });

        if (accessError) {
            console.error('Error creating user access:', accessError);
            // Don't fail the whole request, DSO was created
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
