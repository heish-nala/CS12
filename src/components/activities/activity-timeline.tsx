'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, ActivityType, DataTable, DataColumn, DataRow } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Phone,
    Mail,
    Users,
    FileText,
    GraduationCap,
    MoreHorizontal,
    MessageSquare,
    Plus,
    Download,
    Filter,
    ChevronDown,
    ChevronRight,
    Clock,
    AlertCircle,
} from 'lucide-react';
import { ActivityLoggingDialog, Contact } from '@/components/doctors/activity-logging-dialog';

interface ActivityTimelineProps {
    clientId: string;
}

// Using design system CSS variables for consistent theming
const activityTypeConfig: Record<ActivityType, { label: string; icon: React.ElementType; color: string }> = {
    call: { label: 'Phone Call', icon: Phone, color: 'bg-[var(--notion-blue)] text-[var(--notion-blue-text)]' },
    sms: { label: 'Text Message', icon: MessageSquare, color: 'bg-[var(--notion-purple)] text-[var(--notion-purple-text)]' },
    email: { label: 'Email', icon: Mail, color: 'bg-[var(--notion-green)] text-[var(--notion-green-text)]' },
    meeting: { label: 'Meeting', icon: Users, color: 'bg-[var(--notion-orange)] text-[var(--notion-orange-text)]' },
    case_review: { label: 'Case Review', icon: FileText, color: 'bg-[var(--notion-blue)] text-[var(--notion-blue-text)]' },
    training: { label: 'Training', icon: GraduationCap, color: 'bg-[var(--notion-pink)] text-[var(--notion-pink-text)]' },
    other: { label: 'Other', icon: MoreHorizontal, color: 'bg-[var(--notion-gray)] text-[var(--notion-gray-text)]' },
};

const outcomeConfig: Record<string, { label: string; color: string }> = {
    positive: { label: 'Positive', color: 'bg-[var(--notion-green)] text-[var(--notion-green-text)]' },
    neutral: { label: 'Neutral', color: 'bg-[var(--notion-gray)] text-[var(--notion-gray-text)]' },
    negative: { label: 'Negative', color: 'bg-[var(--notion-red)] text-[var(--notion-red-text)]' },
    follow_up_needed: { label: 'Follow-up Needed', color: 'bg-[var(--notion-orange)] text-[var(--notion-orange-text)]' },
};

interface GroupedActivities {
    [monthYear: string]: Activity[];
}

export function ActivityTimeline({ clientId }: ActivityTimelineProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');
    const [filterContact, setFilterContact] = useState<string>('all');
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [logDialogOpen, setLogDialogOpen] = useState(false);

    useEffect(() => {
        fetchActivities();
        fetchContacts();
    }, [clientId]);

    const fetchActivities = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/activities');
            if (response.ok) {
                const data = await response.json();
                setActivities(data);
                // Auto-expand the current month
                const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                setExpandedMonths(new Set([currentMonth]));
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchContacts = async () => {
        try {
            const allContacts: Contact[] = [];

            // 1. Fetch contacts from Data Tables
            const tablesResponse = await fetch(`/api/data-tables?client_id=${clientId}`);
            if (tablesResponse.ok) {
                const { tables } = await tablesResponse.json();

                // For each table, fetch rows and extract contacts
                for (const table of tables) {
                    const columns: DataColumn[] = table.columns || [];

                    // Find primary (name) column and contact columns
                    const primaryColumn = columns.find(c => c.is_primary);
                    const emailColumn = columns.find(c => c.type === 'email');
                    const phoneColumn = columns.find(c => c.type === 'phone');

                    // If no primary column, skip this table
                    if (!primaryColumn) continue;

                    // Fetch rows for this table
                    const rowsResponse = await fetch(`/api/data-tables/${table.id}/rows`);
                    if (!rowsResponse.ok) continue;

                    const { rows } = await rowsResponse.json();

                    // Extract contacts from rows
                    for (const row of rows) {
                        const name = row.data[primaryColumn.id];
                        if (!name) continue;

                        allContacts.push({
                            id: `table-${table.id}-row-${row.id}`,
                            name: String(name),
                            email: emailColumn ? row.data[emailColumn.id] : undefined,
                            phone: phoneColumn ? row.data[phoneColumn.id] : undefined,
                            tableId: table.id,
                            tableName: table.name,
                        });
                    }
                }
            }

            // 2. Fetch legacy Doctors
            const doctorsResponse = await fetch(`/api/doctors?dso_id=${clientId}`);
            if (doctorsResponse.ok) {
                const { doctors } = await doctorsResponse.json();

                for (const doctor of doctors || []) {
                    allContacts.push({
                        id: `doctor-${doctor.id}`,
                        name: doctor.name,
                        email: doctor.email || undefined,
                        phone: doctor.phone || undefined,
                        tableId: undefined,
                        tableName: 'Doctors',
                    });
                }
            }

            setContacts(allContacts);
        } catch (error) {
            console.error('Error fetching contacts:', error);
        }
    };

    const filteredActivities = useMemo(() => {
        let filtered = activities;
        if (filterType !== 'all') {
            filtered = filtered.filter(a => a.activity_type === filterType);
        }
        if (filterContact !== 'all') {
            // Match by contact name since IDs may differ between sources
            const selectedContact = contacts.find(c => c.id === filterContact);
            if (selectedContact) {
                filtered = filtered.filter(a =>
                    a.contact_name === selectedContact.name ||
                    a.doctor_id === filterContact
                );
            }
        }
        return filtered;
    }, [activities, filterType, filterContact, contacts]);

    const groupedByMonth: GroupedActivities = useMemo(() => {
        const groups: GroupedActivities = {};

        filteredActivities.forEach(activity => {
            const date = new Date(activity.created_at);
            const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            if (!groups[monthYear]) {
                groups[monthYear] = [];
            }
            groups[monthYear].push(activity);
        });

        // Sort activities within each month by date descending
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        });

        return groups;
    }, [filteredActivities]);

    const sortedMonths = useMemo(() => {
        return Object.keys(groupedByMonth).sort((a, b) => {
            const dateA = new Date(a);
            const dateB = new Date(b);
            return dateB.getTime() - dateA.getTime();
        });
    }, [groupedByMonth]);

    const toggleMonth = (month: string) => {
        const newExpanded = new Set(expandedMonths);
        if (newExpanded.has(month)) {
            newExpanded.delete(month);
        } else {
            newExpanded.add(month);
        }
        setExpandedMonths(newExpanded);
    };

    const exportMonth = (month: string) => {
        const monthActivities = groupedByMonth[month];
        if (!monthActivities) return;

        const csvContent = [
            ['Date', 'Type', 'Contact', 'Description', 'Outcome', 'Email', 'Phone'].join(','),
            ...monthActivities.map(a => [
                new Date(a.created_at).toLocaleString(),
                activityTypeConfig[a.activity_type]?.label || a.activity_type,
                a.contact_name || '',
                `"${a.description.replace(/"/g, '""')}"`,
                outcomeConfig[a.outcome || 'neutral']?.label || '',
                a.contact_email || '',
                a.contact_phone || '',
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `activities-${month.toLowerCase().replace(' ', '-')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const followUpCount = activities.filter(a => a.outcome === 'follow_up_needed').length;

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-10 bg-muted animate-pulse rounded" />
                <div className="h-32 bg-muted animate-pulse rounded" />
                <div className="h-32 bg-muted animate-pulse rounded" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">Activity Log</h3>
                    {followUpCount > 0 && (
                        <Badge variant="outline" className="bg-[var(--notion-orange)] text-[var(--notion-orange-text)] border-[var(--notion-orange)]">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {followUpCount} follow-up{followUpCount > 1 ? 's' : ''} needed
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Select value={filterContact} onValueChange={setFilterContact}>
                        <SelectTrigger className="w-[180px]">
                            <Users className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Filter by contact" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Contacts</SelectItem>
                            {contacts.map((contact) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                    <div className="flex items-center gap-2">
                                        <span>{contact.name}</span>
                                        {contact.tableName && (
                                            <span className="text-xs text-muted-foreground">
                                                ({contact.tableName})
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-auto">
                            <Filter className="h-4 w-4 mr-2 shrink-0" />
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Activities</SelectItem>
                            {Object.entries(activityTypeConfig).map(([key, config]) => {
                                const Icon = config.icon;
                                return (
                                    <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4" />
                                            {config.label}
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => setLogDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Log Activity
                    </Button>
                </div>
            </div>

            {/* Activity summary stats */}
            <div className="grid grid-cols-4 gap-4">
                {Object.entries(activityTypeConfig).slice(0, 4).map(([type, config]) => {
                    const Icon = config.icon;
                    const count = activities.filter(a => a.activity_type === type).length;
                    return (
                        <div
                            key={type}
                            className="bg-muted/50 rounded-lg p-3 flex items-center gap-3"
                        >
                            <div className={`p-2 rounded-lg ${config.color}`}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold">{count}</p>
                                <p className="text-xs text-muted-foreground">{config.label}s</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Timeline grouped by month */}
            <div className="space-y-3">
                {sortedMonths.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-medium">No activities logged yet</p>
                        <p className="text-sm">Click "Log Activity" to record your first interaction</p>
                    </div>
                ) : (
                    sortedMonths.map(month => {
                        const monthActivities = groupedByMonth[month];
                        const isExpanded = expandedMonths.has(month);

                        return (
                            <div key={month} className="border rounded-lg overflow-hidden">
                                {/* Month header */}
                                <div className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <button
                                        onClick={() => toggleMonth(month)}
                                        className="flex items-center gap-3 flex-1"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                        <span className="font-medium">{month}</span>
                                        <Badge variant="secondary" className="ml-2">
                                            {monthActivities.length} activit{monthActivities.length === 1 ? 'y' : 'ies'}
                                        </Badge>
                                    </button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <Download className="h-4 w-4 mr-1" />
                                                Export
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => exportMonth(month)}>
                                                Export as CSV
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Activities list */}
                                {isExpanded && (
                                    <div className="divide-y">
                                        {monthActivities.map(activity => {
                                            const typeConfig = activityTypeConfig[activity.activity_type];
                                            const TypeIcon = typeConfig?.icon || MoreHorizontal;
                                            const outcomeInfo = outcomeConfig[activity.outcome || 'neutral'];

                                            return (
                                                <div
                                                    key={activity.id}
                                                    className="p-4 hover:bg-muted/20 transition-colors"
                                                >
                                                    <div className="flex items-start gap-4">
                                                        {/* Icon */}
                                                        <div className={`p-2 rounded-lg shrink-0 ${typeConfig?.color || 'bg-[var(--notion-gray)]'}`}>
                                                            <TypeIcon className="h-4 w-4" />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-medium text-sm">
                                                                    {typeConfig?.label || activity.activity_type}
                                                                </span>
                                                                {activity.contact_name && (
                                                                    <>
                                                                        <span className="text-muted-foreground">with</span>
                                                                        <span className="font-medium text-sm">
                                                                            {activity.contact_name}
                                                                        </span>
                                                                    </>
                                                                )}
                                                                {activity.outcome && (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className={`text-xs ${outcomeInfo?.color || ''}`}
                                                                    >
                                                                        {outcomeInfo?.label || activity.outcome}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mb-2">
                                                                {activity.description}
                                                            </p>
                                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                                <span>{formatDate(activity.created_at)}</span>
                                                                <span>{formatTime(activity.created_at)}</span>
                                                                {activity.contact_email && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Mail className="h-3 w-3" />
                                                                        {activity.contact_email}
                                                                    </span>
                                                                )}
                                                                {activity.contact_phone && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Phone className="h-3 w-3" />
                                                                        {activity.contact_phone}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Log Activity Dialog */}
            <ActivityLoggingDialog
                open={logDialogOpen}
                onOpenChange={setLogDialogOpen}
                clientId={clientId}
                onSuccess={fetchActivities}
            />
        </div>
    );
}
