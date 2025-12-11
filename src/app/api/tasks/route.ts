import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const doctorId = searchParams.get('doctor_id');
        const dsoId = searchParams.get('dso_id');

        let query = supabaseAdmin
            .from('tasks')
            .select(`
                *,
                task_groups(*),
                doctors(id, name)
            `);

        // Filter by doctor if specified
        if (doctorId) {
            query = query.eq('doctor_id', doctorId);
        }

        // Filter by DSO if specified
        if (dsoId) {
            // Get doctors in this DSO first
            const { data: dsoDoctors } = await supabaseAdmin
                .from('doctors')
                .select('id')
                .eq('dso_id', dsoId);

            if (dsoDoctors && dsoDoctors.length > 0) {
                const doctorIds = dsoDoctors.map(d => d.id);
                query = query.in('doctor_id', doctorIds);
            } else {
                // No doctors in this DSO, return empty
                return NextResponse.json({
                    tasks: [],
                    task_groups: [],
                    total: 0,
                });
            }
        }

        const { data: tasks, error: tasksError } = await query;

        if (tasksError) {
            console.error('Error fetching tasks:', tasksError);
            return NextResponse.json({
                tasks: [],
                task_groups: [],
                total: 0,
            });
        }

        // Get all task groups
        const { data: taskGroups } = await supabaseAdmin
            .from('task_groups')
            .select('*');

        // Format tasks with enriched data
        const enrichedTasks = (tasks || []).map((task: any) => ({
            ...task,
            task_group: task.task_groups,
            doctor: task.doctors ? { id: task.doctors.id, name: task.doctors.name } : undefined,
        }));

        return NextResponse.json({
            tasks: enrichedTasks,
            task_groups: taskGroups || [],
            total: enrichedTasks.length,
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { data: task, error } = await supabaseAdmin
            .from('tasks')
            .insert(body)
            .select()
            .single();

        if (error) {
            console.error('Error creating task:', error);
            return NextResponse.json(
                { error: 'Failed to create task' },
                { status: 500 }
            );
        }

        return NextResponse.json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
