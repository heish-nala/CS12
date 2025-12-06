import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export async function GET() {
    try {
        const { data: dsos, error } = await supabase
            .from('dsos')
            .select('*')
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
        const { name } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('dsos')
            .insert({ name })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ dso: data }, { status: 201 });
    } catch (error) {
        console.error('Error creating DSO:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
