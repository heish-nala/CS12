import { NextRequest, NextResponse } from 'next/server';
import {
    getAllTasks,
    getAllTaskGroups,
    getTasksByDoctor,
    getDoctorById,
    mockDoctors,
} from '@/lib/mock-data';
import { TaskWithGroup } from '@/lib/db/types';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const doctorId = searchParams.get('doctor_id');
        const dsoId = searchParams.get('dso_id');

        let tasks = getAllTasks();

        // Filter by doctor if specified
        if (doctorId) {
            tasks = getTasksByDoctor(doctorId);
        }

        // Filter by DSO if specified
        if (dsoId) {
            const dsoDoctors = mockDoctors.filter(d => d.dso_id === dsoId);
            const doctorIds = dsoDoctors.map(d => d.id);
            tasks = tasks.filter(t => t.doctor_id && doctorIds.includes(t.doctor_id));
        }

        const taskGroups = getAllTaskGroups();

        // Enrich tasks with task group and doctor info
        const enrichedTasks: (TaskWithGroup & { doctor?: { id: string; name: string } })[] = tasks.map((task) => {
            const group = taskGroups.find(g => g.id === task.task_group_id);
            const doctor = task.doctor_id ? getDoctorById(task.doctor_id) : undefined;

            return {
                ...task,
                task_group: group!,
                doctor: doctor ? { id: doctor.id, name: doctor.name } : undefined,
            };
        });

        return NextResponse.json({
            tasks: enrichedTasks,
            task_groups: taskGroups,
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

// POST disabled for mock data mode
export async function POST(request: NextRequest) {
    return NextResponse.json(
        { error: 'Creating tasks is disabled in mock data mode' },
        { status: 503 }
    );
}
