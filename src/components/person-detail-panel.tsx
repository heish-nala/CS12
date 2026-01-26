'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Phone,
    Mail,
    Calendar,
    Download,
    Plus,
    MessageSquare,
    Video,
    BookOpen,
    Briefcase,
    MoreHorizontal,
    Clock,
    CheckCircle2,
    AlertCircle,
    MinusCircle,
    Loader2,
} from 'lucide-react';
import { Activity, ActivityType } from '@/lib/db/types';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

// Activity type configuration
const activityTypeConfig: Record<ActivityType, { label: string; icon: React.ElementType; color: string }> = {
    phone: { label: 'Phone', icon: Phone, color: 'bg-[var(--notion-blue)]' },
    email: { label: 'Email', icon: Mail, color: 'bg-[var(--notion-green)]' },
    text: { label: 'Text', icon: MessageSquare, color: 'bg-[var(--notion-purple)]' },
};

// Outcome configuration
const outcomeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    positive: { label: 'Positive', icon: CheckCircle2, color: 'text-[var(--notion-green-text)]' },
    neutral: { label: 'Neutral', icon: MinusCircle, color: 'text-[var(--notion-gray-text)]' },
    negative: { label: 'Negative', icon: AlertCircle, color: 'text-[var(--notion-red-text)]' },
    follow_up_needed: { label: 'Follow-up Needed', icon: Clock, color: 'text-[var(--notion-orange-text)]' },
};

export interface PersonInfo {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    startDate?: string | null;
    source: 'doctor' | 'data_row';
    sourceId?: string; // table_id for data rows
}

interface PersonDetailPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    person: PersonInfo | null;
    clientId: string;
}

export function PersonDetailPanel({
    open,
    onOpenChange,
    person,
    clientId,
}: PersonDetailPanelProps) {
    const { user } = useAuth();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const [showLogForm, setShowLogForm] = useState(false);

    // Form state
    const [activityType, setActivityType] = useState<ActivityType>('phone');
    const [outcome, setOutcome] = useState<string>('neutral');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Fetch activities for this person
    const fetchActivities = useCallback(async () => {
        if (!person) return;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (person.source === 'doctor') {
                params.set('doctor_id', person.id);
            } else {
                params.set('contact_name', person.name);
            }
            params.set('limit', '50');

            const response = await fetch(`/api/activities?${params}`);
            if (response.ok) {
                const data = await response.json();
                setActivities(data.activities || []);
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    }, [person]);

    useEffect(() => {
        if (open && person) {
            fetchActivities();
            setShowLogForm(false);
            setNotes('');
            setOutcome('neutral');
            setActivityType('phone');
        }
    }, [open, person, fetchActivities]);

    // Submit new activity
    const handleSubmitActivity = async () => {
        if (!person || !user) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doctor_id: person.source === 'doctor' ? person.id : null,
                    activity_type: activityType,
                    description: notes || `${activityTypeConfig[activityType].label} with ${person.name}`,
                    outcome,
                    contact_name: person.name,
                    contact_email: person.email,
                    contact_phone: person.phone,
                    user_id: user.id,
                }),
            });

            if (response.ok) {
                toast.success('Activity logged');
                setShowLogForm(false);
                setNotes('');
                fetchActivities();
            } else {
                toast.error('Failed to log activity');
            }
        } catch (error) {
            console.error('Error logging activity:', error);
            toast.error('Failed to log activity');
        } finally {
            setSubmitting(false);
        }
    };

    // Export activities as CSV
    const handleExportCSV = () => {
        if (activities.length === 0) {
            toast.error('No activities to export');
            return;
        }

        const csvContent = [
            ['Date', 'Type', 'Notes', 'Outcome'].join(','),
            ...activities.map(a => [
                new Date(a.created_at).toLocaleString(),
                activityTypeConfig[a.activity_type]?.label || a.activity_type,
                `"${(a.description || '').replace(/"/g, '""')}"`,
                outcomeConfig[a.outcome || 'neutral']?.label || '',
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${person?.name.replace(/[^a-z0-9]/gi, '_')}_activities.csv`;
        link.click();

        toast.success('CSV downloaded');
    };

    // Group activities by month
    const groupedActivities = activities.reduce((groups, activity) => {
        const date = new Date(activity.created_at);
        const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!groups[monthKey]) {
            groups[monthKey] = [];
        }
        groups[monthKey].push(activity);
        return groups;
    }, {} as Record<string, Activity[]>);

    // Format relative date
    const formatRelativeDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString();
    };

    if (!person) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader className="pb-4 border-b">
                    <SheetTitle className="text-xl">{person.name}</SheetTitle>

                    {/* Contact Info */}
                    <div className="space-y-2 pt-2">
                        {person.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                <a href={`mailto:${person.email}`} className="hover:underline">
                                    {person.email}
                                </a>
                            </div>
                        )}
                        {person.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                <a href={`tel:${person.phone}`} className="hover:underline">
                                    {person.phone}
                                </a>
                            </div>
                        )}
                        {person.startDate && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>Started {new Date(person.startDate).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </SheetHeader>

                <div className="py-4 space-y-4">
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setShowLogForm(!showLogForm)}
                            className="flex-1"
                            variant={showLogForm ? 'secondary' : 'default'}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Log Activity
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleExportCSV}
                            disabled={activities.length === 0}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Log Activity Form */}
                    {showLogForm && (
                        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                            <div className="space-y-2">
                                <Label>Activity Type</Label>
                                <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(activityTypeConfig).map(([key, config]) => (
                                            <SelectItem key={key} value={key}>
                                                <div className="flex items-center gap-2">
                                                    <config.icon className="h-4 w-4" />
                                                    {config.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Outcome</Label>
                                <Select value={outcome} onValueChange={setOutcome}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(outcomeConfig).map(([key, config]) => (
                                            <SelectItem key={key} value={key}>
                                                <div className="flex items-center gap-2">
                                                    <config.icon className={`h-4 w-4 ${config.color}`} />
                                                    {config.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea
                                    placeholder="Add notes about this interaction..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    onClick={handleSubmitActivity}
                                    disabled={submitting}
                                    className="flex-1"
                                >
                                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save Activity
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowLogForm(false)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Activity Timeline */}
                    <div className="space-y-1">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Activity History
                        </h3>

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : activities.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No activities yet</p>
                                <p className="text-xs">Log your first interaction above</p>
                            </div>
                        ) : (
                            <div className="space-y-6 pt-2">
                                {Object.entries(groupedActivities).map(([month, monthActivities]) => (
                                    <div key={month}>
                                        <div className="text-xs font-medium text-muted-foreground mb-3">
                                            {month}
                                        </div>
                                        <div className="space-y-3">
                                            {monthActivities.map((activity) => {
                                                const typeConfig = activityTypeConfig[activity.activity_type];
                                                const outcomeConf = outcomeConfig[activity.outcome || 'neutral'];
                                                const TypeIcon = typeConfig?.icon || MoreHorizontal;
                                                const OutcomeIcon = outcomeConf?.icon || MinusCircle;

                                                return (
                                                    <div
                                                        key={activity.id}
                                                        className="flex gap-3 group"
                                                    >
                                                        {/* Timeline dot */}
                                                        <div className="flex flex-col items-center">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${typeConfig?.color || 'bg-muted'}`}>
                                                                <TypeIcon className="h-4 w-4 text-white" />
                                                            </div>
                                                            <div className="w-px flex-1 bg-border mt-2" />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 pb-4">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm font-medium">
                                                                    {typeConfig?.label || activity.activity_type}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatRelativeDate(activity.created_at)}
                                                                </span>
                                                            </div>

                                                            {activity.description && (
                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                    {activity.description}
                                                                </p>
                                                            )}

                                                            {activity.outcome && (
                                                                <div className="flex items-center gap-1 mt-2">
                                                                    <OutcomeIcon className={`h-3.5 w-3.5 ${outcomeConf?.color}`} />
                                                                    <span className={`text-xs ${outcomeConf?.color}`}>
                                                                        {outcomeConf?.label}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
