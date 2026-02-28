import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuthWithFallback, requireOrgDsoAccess, getUserOrg } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Require authentication (with user_id param fallback)
        const authResult = await requireAuthWithFallback(request);
        if ('response' in authResult) {
            return authResult.response;
        }
        const userId = authResult.userId;

        const searchParams = request.nextUrl.searchParams;
        const doctorId = searchParams.get('doctor_id');
        const dsoId = searchParams.get('dso_id');

        // If dso_id is provided, verify user has org + DSO access
        if (dsoId) {
            const accessResult = await requireOrgDsoAccess(request, dsoId);
            if ('response' in accessResult) {
                return accessResult.response;
            }
        }

        // If doctor_id is provided (no dso_id), verify user has access to the doctor's DSO
        if (doctorId && !dsoId) {
            const { data: doctor } = await supabaseAdmin
                .from('doctors')
                .select('dso_id')
                .eq('id', doctorId)
                .single();

            if (doctor) {
                const accessResult = await requireOrgDsoAccess(request, doctor.dso_id);
                if ('response' in accessResult) {
                    return accessResult.response;
                }
            }
        }

        // Get user's org to filter accessible DSOs
        const orgInfo = await getUserOrg(userId);
        if (!orgInfo) {
            return NextResponse.json({
                tasks: [],
                task_groups: [],
                total: 0,
            });
        }

        // Get user's accessible DSOs filtered by org (prevents cross-org enumeration)
        const { data: userAccess } = await supabaseAdmin
            .from('user_dso_access')
            .select('dso_id, dsos!inner(org_id)')
            .eq('user_id', userId)
            .eq('dsos.org_id', orgInfo.orgId);

        const accessibleDsoIds = userAccess?.map(a => a.dso_id) || [];

        if (accessibleDsoIds.length === 0) {
            return NextResponse.json({
                tasks: [],
                task_groups: [],
                total: 0,
            });
        }

        // Get doctors in accessible DSOs
        let doctorQuery = supabaseAdmin
            .from('doctors')
            .select('id')
            .in('dso_id', accessibleDsoIds);

        if (dsoId) {
            doctorQuery = doctorQuery.eq('dso_id', dsoId);
        }

        const { data: accessibleDoctors } = await doctorQuery;
        const accessibleDoctorIds = accessibleDoctors?.map(d => d.id) || [];

        if (accessibleDoctorIds.length === 0) {
            return NextResponse.json({
                tasks: [],
                task_groups: [],
                total: 0,
            });
        }

        let query = supabaseAdmin
            .from('tasks')
            .select(`
                *,
                task_groups(*),
                doctors(id, name)
            `)
            .in('doctor_id', accessibleDoctorIds);

        // Filter by doctor if specified
        if (doctorId) {
            query = query.eq('doctor_id', doctorId);
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

        // If doctor_id is provided, verify user has write access to the doctor's DSO
        if (body.doctor_id) {
            const { data: doctor } = await supabaseAdmin
                .from('doctors')
                .select('dso_id')
                .eq('id', body.doctor_id)
                .single();

            if (doctor) {
                const accessResult = await requireOrgDsoAccess(request, doctor.dso_id, true, body);
                if ('response' in accessResult) {
                    return accessResult.response;
                }
            }
        } else {
            // No doctor_id — require basic auth with fallback
            const authResult = await requireAuthWithFallback(request);
            if ('response' in authResult) {
                if (!body.user_id) {
                    return authResult.response;
                }
            }
        }

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
