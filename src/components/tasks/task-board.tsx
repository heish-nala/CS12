'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Task, TaskGroup } from '@/lib/db/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';

interface TaskWithDoctor extends Task {
    task_group: TaskGroup;
    doctor?: { id: string; name: string };
}

interface TaskBoardResponse {
    tasks: TaskWithDoctor[];
    task_groups: TaskGroup[];
    total: number;
}

export function TaskBoard() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const dsoId = searchParams.get('dso_id');

    const [data, setData] = useState<TaskBoardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDoctor, setSelectedDoctor] = useState<string>('all');

    useEffect(() => {
        fetchTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dsoId, selectedDoctor]);

    const fetchTasks = async () => {
        try {
            const params = new URLSearchParams();
            if (dsoId) params.append('dso_id', dsoId);
            if (selectedDoctor && selectedDoctor !== 'all') {
                params.append('doctor_id', selectedDoctor);
            }
            if (user?.id) params.append('user_id', user.id);

            const response = await fetch(`/api/tasks?${params}`);
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    // Using design system CSS variables for consistent theming
    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-[var(--notion-green)] text-[var(--notion-green-text)] border-[var(--notion-green)]';
            case 'in_progress':
                return 'bg-[var(--notion-blue)] text-[var(--notion-blue-text)] border-[var(--notion-blue)]';
            case 'blocked':
                return 'bg-[var(--notion-red)] text-[var(--notion-red-text)] border-[var(--notion-red)]';
            default:
                return 'bg-[var(--notion-gray)] text-[var(--notion-gray-text)] border-[var(--notion-gray)]';
        }
    };

    const getColumnColor = (groupName: string) => {
        switch (groupName.toLowerCase()) {
            case 'to do':
                return 'bg-[var(--notion-gray)]';
            case 'in progress':
                return 'bg-[var(--notion-blue)]';
            case 'completed':
                return 'bg-[var(--notion-green)]';
            case 'blocked':
                return 'bg-[var(--notion-red)]';
            default:
                return 'bg-[var(--notion-gray)]';
        }
    };

    const isOverdue = (dueDate: string | null) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    };

    // Get unique doctors from tasks
    const uniqueDoctors = data?.tasks.reduce((acc, task) => {
        if (task.doctor && !acc.find(d => d.id === task.doctor!.id)) {
            acc.push(task.doctor);
        }
        return acc;
    }, [] as { id: string; name: string }[]) || [];

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-4">
                        <div className="h-12 bg-muted animate-pulse rounded" />
                        <div className="h-32 bg-muted animate-pulse rounded" />
                        <div className="h-32 bg-muted animate-pulse rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6">
            {/* Filter Controls */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by doctor" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Doctors</SelectItem>
                            {uniqueDoctors.map((doctor) => (
                                <SelectItem key={doctor.id} value={doctor.id}>
                                    {doctor.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Badge variant="outline" className="ml-auto">
                    {data.total} tasks
                </Badge>
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.task_groups.map((group) => {
                    const groupTasks = data.tasks.filter(t => t.task_group_id === group.id);

                    return (
                        <div key={group.id} className="space-y-3">
                            {/* Column Header */}
                            <div className={`p-4 rounded-lg ${getColumnColor(group.name)}`}>
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-sm">{group.name}</h3>
                                    <Badge variant="secondary" className="text-xs">
                                        {groupTasks.length}
                                    </Badge>
                                </div>
                                {group.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {group.description}
                                    </p>
                                )}
                            </div>

                            {/* Task Cards */}
                            <div className="space-y-3">
                                {groupTasks.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                                        No tasks
                                    </div>
                                ) : (
                                    groupTasks.map((task) => (
                                        <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm font-medium">
                                                    {task.title}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {task.description && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        {task.description}
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-xs ${getStatusBadgeColor(task.status)}`}
                                                    >
                                                        {task.status}
                                                    </Badge>

                                                    {task.due_date && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-xs flex items-center gap-1 ${
                                                                isOverdue(task.due_date)
                                                                    ? 'bg-[var(--notion-red)] text-[var(--notion-red-text)] border-[var(--notion-red)]'
                                                                    : ''
                                                            }`}
                                                        >
                                                            <Calendar className="h-3 w-3" />
                                                            {format(new Date(task.due_date), 'MMM d')}
                                                            {isOverdue(task.due_date) && (
                                                                <AlertCircle className="h-3 w-3" />
                                                            )}
                                                        </Badge>
                                                    )}
                                                </div>

                                                {task.doctor && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <User className="h-3 w-3" />
                                                        <span>{task.doctor.name}</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
