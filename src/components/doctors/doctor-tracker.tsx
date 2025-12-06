'use client';

import { useEffect, useState } from 'react';
import { Doctor, DoctorWithDSO, RiskLevel, CustomColumn } from '@/lib/db/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Plus, MoreVertical, Edit, Activity, BarChart3, Trash2 } from 'lucide-react';
import { EditDoctorDialog } from './edit-doctor-dialog';
import { ActivityLoggingDialog } from './activity-logging-dialog';
import { PeriodProgressDialog } from './period-progress-dialog';
import { EditableCell } from './editable-cell';
import { TableColumnHeader } from './table-column-header';
import { CustomFieldCell } from './custom-field-cell';
import { toast } from 'sonner';
import { useMetricConfigOrDefault } from '@/contexts/metric-config-context';

interface DoctorTrackerProps {
    dsoId?: string;
}

export function DoctorTracker({ dsoId }: DoctorTrackerProps) {
    const metricConfig = useMetricConfigOrDefault();
    const [doctors, setDoctors] = useState<DoctorWithDSO[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

    // Dialog states
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [activityDialogOpen, setActivityDialogOpen] = useState(false);
    const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | undefined>();

    useEffect(() => {
        fetchDoctors();
        loadCustomColumns();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dsoId]);

    const loadCustomColumns = () => {
        try {
            const stored = localStorage.getItem('doctor_custom_columns');
            if (stored) {
                setCustomColumns(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading custom columns:', error);
        }
    };

    const saveCustomColumns = (columns: CustomColumn[]) => {
        try {
            localStorage.setItem('doctor_custom_columns', JSON.stringify(columns));
            setCustomColumns(columns);
        } catch (error) {
            console.error('Error saving custom columns:', error);
            toast.error('Failed to save columns');
        }
    };

    const addCustomColumn = () => {
        const newColumn: CustomColumn = {
            id: `custom_${Date.now()}`,
            name: 'New Column',
            type: 'text',
            order_index: customColumns.length,
        };
        const updated = [...customColumns, newColumn];
        saveCustomColumns(updated);
        toast.success('Column added');
    };

    const updateCustomColumn = (columnId: string, updates: Partial<CustomColumn>) => {
        const updated = customColumns.map(col =>
            col.id === columnId ? { ...col, ...updates } : col
        );
        saveCustomColumns(updated);
    };

    const deleteCustomColumn = (columnId: string) => {
        const updated = customColumns.filter(col => col.id !== columnId);
        saveCustomColumns(updated);
        toast.success('Column deleted');
    };

    const fetchDoctors = async () => {
        try {
            const params = new URLSearchParams();
            if (dsoId) params.append('dso_id', dsoId);
            if (search) params.append('search', search);

            const response = await fetch(`/api/doctors?${params}`);
            const data = await response.json();
            setDoctors(data.doctors || []);
        } catch (error) {
            console.error('Error fetching doctors:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateDoctorField = async (doctorId: string, field: string, value: string) => {
        try {
            // TODO: Replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 500));

            // Optimistically update the UI
            setDoctors(doctors.map(d =>
                d.id === doctorId ? { ...d, [field]: value } : d
            ));

            toast.success('Doctor updated successfully');
        } catch (error) {
            console.error('Error updating doctor:', error);
            toast.error('Failed to update doctor');
            throw error;
        }
    };

    const updateCustomField = async (doctorId: string, columnId: string, value: any) => {
        try {
            // TODO: Replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 500));

            // Optimistically update the UI
            setDoctors(doctors.map(d => {
                if (d.id === doctorId) {
                    return {
                        ...d,
                        custom_fields: {
                            ...(d.custom_fields || {}),
                            [columnId]: value,
                        },
                    };
                }
                return d;
            }));

            toast.success('Field updated successfully');
        } catch (error) {
            console.error('Error updating custom field:', error);
            toast.error('Failed to update field');
            throw error;
        }
    };

    const getRiskBadge = (riskLevel?: RiskLevel) => {
        // Using design system CSS variables for consistent theming
        const variants = {
            low: 'bg-[var(--notion-green)] text-[var(--notion-green-text)] border-[var(--notion-green)]',
            medium: 'bg-[var(--notion-yellow)] text-[var(--notion-yellow-text)] border-[var(--notion-yellow)]',
            high: 'bg-[var(--notion-orange)] text-[var(--notion-orange-text)] border-[var(--notion-orange)]',
            critical: 'bg-[var(--notion-red)] text-[var(--notion-red-text)] border-[var(--notion-red)]',
        };

        return (
            <Badge variant="outline" className={variants[riskLevel || 'low']}>
                {riskLevel?.toUpperCase()}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
                <div className="h-64 w-full bg-muted animate-pulse rounded" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search doctors..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchDoctors()}
                        className="pl-9"
                    />
                </div>
                <Button
                    onClick={() => {
                        setSelectedDoctor(undefined);
                        setEditDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Doctor
                </Button>
            </div>

            <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b">
                            <TableHead>
                                <TableColumnHeader name="Name" type="text" />
                            </TableHead>
                            <TableHead>
                                <TableColumnHeader name="Email" type="email" />
                            </TableHead>
                            <TableHead>
                                <TableColumnHeader name="Phone" type="phone" />
                            </TableHead>
                            {metricConfig.isMetricEnabled('risk_level') && (
                                <TableHead>
                                    <TableColumnHeader name="Risk Level" type="select" />
                                </TableHead>
                            )}
                            {(metricConfig.isMetricEnabled('last_activity_date') || metricConfig.isMetricEnabled('days_since_activity')) && (
                                <TableHead>
                                    <TableColumnHeader name="Last Activity" type="date" />
                                </TableHead>
                            )}
                            {metricConfig.isMetricEnabled('total_cases') && (
                                <TableHead>
                                    <TableColumnHeader name="Cases" type="number" />
                                </TableHead>
                            )}
                            {metricConfig.isMetricEnabled('course_progress') && (
                                <TableHead>
                                    <TableColumnHeader name="Course Progress" type="number" />
                                </TableHead>
                            )}
                            {metricConfig.isMetricEnabled('days_in_program') && (
                                <TableHead>
                                    <TableColumnHeader name="Start Date" type="date" />
                                </TableHead>
                            )}
                            <TableHead>
                                <TableColumnHeader name="Status" type="select" />
                            </TableHead>
                            {customColumns.map((column) => (
                                <TableHead key={column.id}>
                                    <TableColumnHeader
                                        name={column.name}
                                        type={column.type}
                                        options={column.options}
                                        isCustom={true}
                                        canDelete={true}
                                        canRename={true}
                                        canChangeType={true}
                                        canHide={true}
                                        onUpdate={(updates) => updateCustomColumn(column.id, updates)}
                                        onDelete={() => deleteCustomColumn(column.id)}
                                    />
                                </TableHead>
                            ))}
                            <TableHead className="w-[50px]">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={addCustomColumn}
                                    className="h-7 w-7 p-0 hover:bg-accent/50 rounded"
                                    title="Add column"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {doctors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10 + customColumns.length + 1} className="text-center py-8 text-muted-foreground">
                                    No doctors found. Add your first doctor to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            doctors.map((doctor) => (
                                <TableRow
                                    key={doctor.id}
                                    className="hover:bg-accent/30 transition-colors border-b last:border-0 group"
                                >
                                    <TableCell className="font-medium">
                                        <EditableCell
                                            value={doctor.name}
                                            onSave={(value) => updateDoctorField(doctor.id, 'name', value)}
                                            placeholder="Doctor name"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <EditableCell
                                            value={doctor.email || ''}
                                            onSave={(value) => updateDoctorField(doctor.id, 'email', value)}
                                            type="email"
                                            placeholder="Email"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <EditableCell
                                            value={doctor.phone || ''}
                                            onSave={(value) => updateDoctorField(doctor.id, 'phone', value)}
                                            type="tel"
                                            placeholder="Phone"
                                        />
                                    </TableCell>
                                    {metricConfig.isMetricEnabled('risk_level') && (
                                        <TableCell>{getRiskBadge(doctor.risk_level)}</TableCell>
                                    )}
                                    {(metricConfig.isMetricEnabled('last_activity_date') || metricConfig.isMetricEnabled('days_since_activity')) && (
                                        <TableCell className="text-sm text-muted-foreground">
                                            {doctor.days_since_activity !== undefined
                                                ? doctor.days_since_activity > 100
                                                    ? 'Never'
                                                    : `${doctor.days_since_activity}d ago`
                                                : 'N/A'}
                                        </TableCell>
                                    )}
                                    {metricConfig.isMetricEnabled('total_cases') && (
                                        <TableCell>{doctor.total_cases || 0}</TableCell>
                                    )}
                                    {metricConfig.isMetricEnabled('course_progress') && (
                                        <TableCell>
                                            {doctor.course_progress_percent !== undefined
                                                ? `${doctor.course_progress_percent}%`
                                                : 'N/A'}
                                        </TableCell>
                                    )}
                                    {metricConfig.isMetricEnabled('days_in_program') && (
                                        <TableCell className="text-sm">
                                            {new Date(doctor.start_date).toLocaleDateString()}
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Badge variant={doctor.status === 'active' ? 'default' : 'secondary'}>
                                            {doctor.status}
                                        </Badge>
                                    </TableCell>
                                    {customColumns.map((column) => (
                                        <TableCell key={column.id}>
                                            <CustomFieldCell
                                                column={column}
                                                value={doctor.custom_fields?.[column.id]}
                                                onSave={(value) => updateCustomField(doctor.id, column.id, value)}
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedDoctor(doctor);
                                                        setPeriodDialogOpen(true);
                                                    }}
                                                >
                                                    <BarChart3 className="h-4 w-4" />
                                                    View Progress
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedDoctor(doctor);
                                                        setActivityDialogOpen(true);
                                                    }}
                                                >
                                                    <Activity className="h-4 w-4" />
                                                    Log Activity
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedDoctor(doctor);
                                                        setEditDialogOpen(true);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                    Edit Doctor
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => {
                                                        toast.error('Delete functionality coming soon');
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Dialogs */}
            <EditDoctorDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                doctor={selectedDoctor}
                onSuccess={fetchDoctors}
            />

            <ActivityLoggingDialog
                open={activityDialogOpen}
                onOpenChange={setActivityDialogOpen}
                clientId={dsoId || ''}
                onSuccess={fetchDoctors}
            />

            <PeriodProgressDialog
                open={periodDialogOpen}
                onOpenChange={setPeriodDialogOpen}
                doctorId={selectedDoctor?.id}
                doctorName={selectedDoctor?.name}
            />
        </div>
    );
}
