'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ActivityType } from '@/lib/db/types';
import { toast } from 'sonner';
import { Phone, Mail, Users, FileText, GraduationCap, MoreHorizontal, MessageSquare, User, Settings } from 'lucide-react';

export interface Contact {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    tableId?: string;
    tableName?: string;
}

interface ContactSourceConfig {
    tableId: string;
    tableName: string;
    nameColumnId: string;
    emailColumnId?: string;
    phoneColumnId?: string;
}

interface ActivityLoggingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    onSuccess?: () => void;
}

const STORAGE_KEY_PREFIX = 'activity-contact-source-';

const activityTypes: { value: ActivityType; label: string; icon: React.ElementType }[] = [
    { value: 'call', label: 'Phone Call', icon: Phone },
    { value: 'sms', label: 'Text Message', icon: MessageSquare },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'meeting', label: 'Meeting', icon: Users },
    { value: 'case_review', label: 'Case Review', icon: FileText },
    { value: 'training', label: 'Training Session', icon: GraduationCap },
    { value: 'other', label: 'Other', icon: MoreHorizontal },
];

// Using design system CSS variables for consistent theming
const outcomeOptions = [
    { value: 'positive', label: 'Positive', color: 'bg-[var(--notion-green)] text-[var(--notion-green-text)]' },
    { value: 'neutral', label: 'Neutral', color: 'bg-[var(--notion-gray)] text-[var(--notion-gray-text)]' },
    { value: 'negative', label: 'Negative', color: 'bg-[var(--notion-red)] text-[var(--notion-red-text)]' },
    { value: 'follow_up_needed', label: 'Follow-up Needed', color: 'bg-[var(--notion-orange)] text-[var(--notion-orange-text)]' },
];

export function ActivityLoggingDialog({
    open,
    onOpenChange,
    clientId,
    onSuccess,
}: ActivityLoggingDialogProps) {
    const [loading, setLoading] = useState(false);
    const [activityType, setActivityType] = useState<ActivityType>('call');
    const [notes, setNotes] = useState('');
    const [outcome, setOutcome] = useState<string>('neutral');

    // Configuration and contacts
    const [config, setConfig] = useState<ContactSourceConfig | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContactId, setSelectedContactId] = useState<string>('');
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [notConfigured, setNotConfigured] = useState(false);

    // Load config and contacts when dialog opens
    useEffect(() => {
        if (open && clientId) {
            const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${clientId}`);
            if (stored) {
                try {
                    const savedConfig = JSON.parse(stored) as ContactSourceConfig;
                    setConfig(savedConfig);
                    setNotConfigured(false);
                    fetchContacts(savedConfig);
                } catch {
                    setConfig(null);
                    setNotConfigured(true);
                }
            } else {
                setConfig(null);
                setNotConfigured(true);
            }
        }
    }, [open, clientId]);

    // Reset form state when dialog closes
    useEffect(() => {
        if (!open) {
            setSelectedContactId('');
            setNotes('');
            setActivityType('call');
            setOutcome('neutral');
            setContacts([]);
        }
    }, [open]);

    const fetchContacts = async (cfg: ContactSourceConfig) => {
        setLoadingContacts(true);
        try {
            const response = await fetch(`/api/data-tables/${cfg.tableId}/rows`);
            if (response.ok) {
                const { rows } = await response.json();
                const allContacts: Contact[] = [];

                for (const row of rows || []) {
                    const name = row.data[cfg.nameColumnId];
                    if (!name) continue;

                    allContacts.push({
                        id: `row-${row.id}`,
                        name: String(name),
                        email: cfg.emailColumnId ? row.data[cfg.emailColumnId] : undefined,
                        phone: cfg.phoneColumnId ? row.data[cfg.phoneColumnId] : undefined,
                    });
                }

                setContacts(allContacts);
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
        } finally {
            setLoadingContacts(false);
        }
    };

    const selectedContact = contacts.find(c => c.id === selectedContactId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedContactId) {
            toast.error('Please select a contact');
            return;
        }

        if (!notes.trim()) {
            toast.error('Please add notes about this activity');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doctor_id: selectedContactId,
                    activity_type: activityType,
                    description: notes.trim(),
                    outcome,
                    contact_name: selectedContact?.name,
                    contact_email: selectedContact?.email,
                    contact_phone: selectedContact?.phone,
                    created_by: 'current-user',
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to log activity');
            }

            toast.success('Activity logged successfully');
            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            console.error('Error logging activity:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to log activity');
        } finally {
            setLoading(false);
        }
    };

    // Not configured state
    if (notConfigured) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Contact Source Not Configured</DialogTitle>
                        <DialogDescription>
                            Please configure your contact source in Settings before logging activities.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-4 pt-4">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                                <Settings className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Go to <span className="font-medium text-foreground">Settings → Activity</span> to configure which columns contain your contact information.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Log Activity</DialogTitle>
                    <DialogDescription>
                        Record an interaction with a contact.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 p-4 pt-4">
                    {/* Contact selector */}
                    <div className="space-y-2">
                        <Label>Contact *</Label>
                        <Select
                            value={selectedContactId}
                            onValueChange={setSelectedContactId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={loadingContacts ? "Loading..." : "Select a contact..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {contacts.length === 0 ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        {loadingContacts ? 'Loading contacts...' : 'No contacts found'}
                                    </div>
                                ) : (
                                    contacts.map((contact) => (
                                        <SelectItem key={contact.id} value={contact.id}>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>{contact.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Selected contact info banner */}
                    {selectedContact && (selectedContact.email || selectedContact.phone) && (
                        <div className="bg-muted rounded-lg p-3 text-sm">
                            <p className="font-medium text-foreground">{selectedContact.name}</p>
                            <div className="flex gap-4 mt-1 text-muted-foreground">
                                {selectedContact.email && <span>{selectedContact.email}</span>}
                                {selectedContact.phone && <span>{selectedContact.phone}</span>}
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="activity-type">Activity Type *</Label>
                            <Select
                                value={activityType}
                                onValueChange={(value) => setActivityType(value as ActivityType)}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {activityTypes.map((type) => {
                                        const Icon = type.icon;
                                        return (
                                            <SelectItem key={type.value} value={type.value}>
                                                <div className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4" />
                                                    {type.label}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="outcome">Outcome</Label>
                            <Select
                                value={outcome}
                                onValueChange={setOutcome}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {outcomeOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${opt.color}`}>
                                                {opt.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes *</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Describe what was discussed or accomplished..."
                            rows={4}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Include key discussion points, action items, and next steps.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !selectedContactId}>
                            {loading ? 'Logging...' : 'Log Activity'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
