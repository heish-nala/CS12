'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
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
import { useAuth } from '@/contexts/auth-context';

interface DoctorTrackerProps {
    dsoId?: string;
}

// Memoized table row component to prevent unnecessary re-renders
interface DoctorRowProps {
    doctor: DoctorWithDSO;
    metricConfig: ReturnType<typeof useMetricConfigOrDefault>;
    customColumns: CustomColumn[];
    onUpdateField: (doctorId: string, field: string, value: string) => void | Promise<void>;
    onUpdateCustomField: (doctorId: string, columnId: string, value: any) => void | Promise<void>;
    onViewProgress: (doctor: Doctor) => void;
    onLogActivity: (doctor: Doctor) => void;
    onEditDoctor: (doctor: Doctor) => void;
    getRiskBadge: (riskLevel?: RiskLevel) => React.ReactNode;
}

const DoctorRow = memo(function DoctorRow({
    doctor,
    metricConfig,
    customColumns,
    onUpdateField,
    onUpdateCustomField,
    onViewProgress,
    onLogActivity,
    onEditDoctor,
    getRiskBadge,
}: DoctorRowProps) {
    return (
        <TableRow
            className="hover:bg-accent/30 transition-colors border-b last:border-0 group"
        >
            <TableCell className="font-medium">
                <EditableCell
                    value={doctor.name}
                    onSave={async (value) => { onUpdateField(doctor.id, 'name', value); }}
                    placeholder="Doctor name"
                />
            </TableCell>
            <TableCell>
                <EditableCell
                    value={doctor.email || ''}
                    onSave={async (value) => { onUpdateField(doctor.id, 'email', value); }}
                    type="email"
                    placeholder="Email"
                />
            </TableCell>
            <TableCell>
                <EditableCell
                    value={doctor.phone || ''}
                    onSave={async (value) => { onUpdateField(doctor.id, 'phone', value); }}
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
                        onSave={async (value) => { onUpdateCustomField(doctor.id, column.id, value); }}
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
                        <DropdownMenuItem onClick={() => onViewProgress(doctor)}>
                            <BarChart3 className="h-4 w-4" />
                            View Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onLogActivity(doctor)}>
                            <Activity className="h-4 w-4" />
                            Log Activity
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEditDoctor(doctor)}>
                            <Edit className="h-4 w-4" />
                            Edit Doctor
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => toast.error('Delete functionality coming soon')}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
});

export function DoctorTracker({ dsoId }: DoctorTrackerProps) {
    const { user } = useAuth();
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

    // Debounced search to prevent excessive re-renders and API calls
    const debouncedFetchDoctors = useDebouncedCallback(
        (searchQuery: string) => {
            fetchDoctorsWithSearch(searchQuery);
        },
        300 // 300ms debounce
    );

    useEffect(() => {
        fetchDoctors();
        loadCustomColumns();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dsoId]);

    // Trigger debounced search when search changes
    useEffect(() => {
        if (search) {
            debouncedFetchDoctors(search);
        }
    }, [search, debouncedFetchDoctors]);

    // Client-side filtering for instant feedback while waiting for API
    const filteredDoctors = useMemo(() => {
        if (!search) return doctors;
        const lowerSearch = search.toLowerCase();
        return doctors.filter(d =>
            d.name.toLowerCase().includes(lowerSearch) ||
            d.email?.toLowerCase().includes(lowerSearch) ||
            d.phone?.toLowerCase().includes(lowerSearch)
        );
    }, [doctors, search]);

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
            if (user?.id) params.append('user_id', user.id);

            const response = await fetch(`/api/doctors?${params}`);
            const data = await response.json();
            setDoctors(data.doctors || []);
        } catch (error) {
            console.error('Error fetching doctors:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDoctorsWithSearch = async (searchQuery: string) => {
        try {
            const params = new URLSearchParams();
            if (dsoId) params.append('dso_id', dsoId);
            if (searchQuery) params.append('search', searchQuery);
            if (user?.id) params.append('user_id', user.id);

            const response = await fetch(`/api/doctors?${params}`);
            const data = await response.json();
            setDoctors(data.doctors || []);
        } catch (error) {
            console.error('Error fetching doctors:', error);
        }
    };

    const updateDoctorField = useCallback((doctorId: string, field: string, value: string) => {
        // Optimistically update the UI first
        setDoctors(prev => {
            const previousDoctors = [...prev];
            const updated = prev.map(d =>
                d.id === doctorId ? { ...d, [field]: value } : d
            );

            // Make API call (fire and forget with error handling)
            fetch(`/api/doctors/${doctorId}?user_id=${user?.id || ''}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value, user_id: user?.id }),
            })
                .then(response => {
                    if (!response.ok) throw new Error('Failed to update doctor');
                    toast.success('Doctor updated successfully');
                })
                .catch(error => {
                    // Revert on error
                    setDoctors(previousDoctors);
                    console.error('Error updating doctor:', error);
                    toast.error('Failed to update doctor');
                });

            return updated;
        });
    }, []);

    const updateCustomField = useCallback((doctorId: string, columnId: string, value: any) => {
        // Custom fields are stored in local state only (columns defined in localStorage)
        setDoctors(prev => prev.map(d => {
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
        toast.success('Field updated');
    }, []);

    const getRiskBadge = useCallback((riskLevel?: RiskLevel) => {
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
    }, []);

    // Memoized callbacks for row actions to prevent re-renders
    const handleViewProgress = useCallback((doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setPeriodDialogOpen(true);
    }, []);

    const handleLogActivity = useCallback((doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setActivityDialogOpen(true);
    }, []);

    const handleEditDoctor = useCallback((doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setEditDialogOpen(true);
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                {/* Search bar skeleton */}
                <div className="flex items-center justify-between gap-4">
                    <div className="h-10 w-64 bg-muted/40 animate-pulse rounded" />
                    <div className="h-10 w-32 bg-muted/40 animate-pulse rounded" />
                </div>
                {/* Table skeleton matching actual structure */}
                <div className="table-skeleton">
                    <div className="table-skeleton-header">
                        <div className="table-skeleton-cell flex-1 max-w-[150px]" />
                        <div className="table-skeleton-cell flex-1 max-w-[180px]" />
                        <div className="table-skeleton-cell flex-1 max-w-[120px]" />
                        <div className="table-skeleton-cell w-16" />
                    </div>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="table-skeleton-row" style={{ opacity: 1 - i * 0.15 }}>
                            <div className="table-skeleton-cell flex-1 max-w-[150px]" />
                            <div className="table-skeleton-cell flex-1 max-w-[180px]" />
                            <div className="table-skeleton-cell flex-1 max-w-[120px]" />
                            <div className="table-skeleton-cell w-16" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 content-loaded">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search doctors..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
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
                        {filteredDoctors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10 + customColumns.length + 1} className="text-center py-8 text-muted-foreground">
                                    {search ? 'No doctors match your search.' : 'No doctors found. Add your first doctor to get started.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredDoctors.map((doctor) => (
                                <DoctorRow
                                    key={doctor.id}
                                    doctor={doctor}
                                    metricConfig={metricConfig}
                                    customColumns={customColumns}
                                    onUpdateField={updateDoctorField}
                                    onUpdateCustomField={updateCustomField}
                                    onViewProgress={handleViewProgress}
                                    onLogActivity={handleLogActivity}
                                    onEditDoctor={handleEditDoctor}
                                    getRiskBadge={getRiskBadge}
                                />
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
