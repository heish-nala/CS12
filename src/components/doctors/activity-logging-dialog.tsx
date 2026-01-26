'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
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
import { ActivityType, DataColumn } from '@/lib/db/types';
import { toast } from 'sonner';
import { Phone, Mail, MessageSquare, User, Loader2 } from 'lucide-react';

export interface Contact {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    tableId?: string;
    tableName?: string;
}

interface ActivityLoggingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    onSuccess?: () => void;
}

const activityTypes: { value: ActivityType; label: string; icon: React.ElementType }[] = [
    { value: 'phone', label: 'Phone', icon: Phone },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'text', label: 'Text', icon: MessageSquare },
];

// Using design system CSS variables for consistent theming
const outcomeOptions = [
    { value: 'positive', label: 'Positive', color: 'bg-[var(--notion-green)] text-[var(--notion-green-text)]' },
    { value: 'neutral', label: 'Neutral', color: 'bg-[var(--notion-gray)] text-[var(--notion-gray-text)]' },
    { value: 'negative', label: 'Negative', color: 'bg-[var(--notion-red)] text-[var(--notion-red-text)]' },
    { value: 'follow_up_needed', label: 'Follow-up Needed', color: 'bg-[var(--notion-orange)] text-[var(--notion-orange-text)]' },
];

// Auto-detect contact columns based on name and type
function detectContactColumns(columns: DataColumn[]): {
    nameColumnId?: string;
    emailColumnId?: string;
    phoneColumnId?: string;
} {
    const result: {
        nameColumnId?: string;
        emailColumnId?: string;
        phoneColumnId?: string;
    } = {};

    for (const col of columns) {
        const nameLower = col.name.toLowerCase();

        // Detect name column
        if (!result.nameColumnId) {
            if (nameLower === 'name' || nameLower === 'full name' || nameLower === 'contact name' || nameLower === 'attendee' || nameLower === 'doctor') {
                result.nameColumnId = col.id;
            }
        }

        // Detect email column
        if (!result.emailColumnId) {
            if (col.type === 'email' || nameLower === 'email' || nameLower.includes('email')) {
                result.emailColumnId = col.id;
            }
        }

        // Detect phone column
        if (!result.phoneColumnId) {
            if (col.type === 'phone' || nameLower === 'phone' || nameLower.includes('phone')) {
                result.phoneColumnId = col.id;
            }
        }
    }

    return result;
}

export function ActivityLoggingDialog({
    open,
    onOpenChange,
    clientId,
    onSuccess,
}: ActivityLoggingDialogProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activityType, setActivityType] = useState<ActivityType>('phone');
    const [notes, setNotes] = useState('');
    const [outcome, setOutcome] = useState<string>('neutral');

    // Contacts state
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContactId, setSelectedContactId] = useState<string>('');
    const [loadingContacts, setLoadingContacts] = useState(false);

    // Auto-fetch contacts when dialog opens
    useEffect(() => {
        if (open && clientId) {
            fetchContactsFromTables();
        }
    }, [open, clientId]);

    // Reset form state when dialog closes
    useEffect(() => {
        if (!open) {
            setSelectedContactId('');
            setNotes('');
            setActivityType('phone');
            setOutcome('neutral');
            setContacts([]);
        }
    }, [open]);

    const fetchContactsFromTables = async () => {
        setLoadingContacts(true);
        try {
            // Fetch all tables for this client
            const userIdParam = user?.id ? `&user_id=${user.id}` : '';
            const tablesResponse = await fetch(`/api/data-tables?client_id=${clientId}${userIdParam}`);
            if (!tablesResponse.ok) {
                throw new Error('Failed to fetch tables');
            }
            const { tables } = await tablesResponse.json();

            if (!tables || tables.length === 0) {
                setContacts([]);
                return;
            }

            const allContacts: Contact[] = [];

            // Process each table
            for (const table of tables) {
                // Fetch full table data with rows
                const tableUserIdParam = user?.id ? `?user_id=${user.id}` : '';
                const tableResponse = await fetch(`/api/data-tables/${table.id}${tableUserIdParam}`);
                if (!tableResponse.ok) continue;

                const { table: fullTable } = await tableResponse.json();
                const columns = fullTable.columns || [];
                const rows = fullTable.rows || [];

                // Auto-detect contact columns
                const detected = detectContactColumns(columns);
                if (!detected.nameColumnId) continue;

                // Extract contacts from rows
                for (const row of rows) {
                    const name = row.data[detected.nameColumnId];
                    if (!name) continue;

                    allContacts.push({
                        id: row.id,
                        name: String(name),
                        email: detected.emailColumnId ? row.data[detected.emailColumnId] : undefined,
                        phone: detected.phoneColumnId ? row.data[detected.phoneColumnId] : undefined,
                        tableId: table.id,
                        tableName: table.name,
                    });
                }
            }

            setContacts(allContacts);
        } catch (error) {
            console.error('Error fetching contacts:', error);
            toast.error('Failed to load contacts');
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
                    activity_type: activityType,
                    description: notes.trim(),
                    outcome,
                    contact_name: selectedContact?.name,
                    contact_email: selectedContact?.email,
                    contact_phone: selectedContact?.phone,
                    user_id: user?.id,
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
                                <SelectValue placeholder={loadingContacts ? "Loading contacts..." : "Select a contact..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {loadingContacts ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                                        Loading contacts...
                                    </div>
                                ) : contacts.length === 0 ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        No contacts found. Add attendees first.
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
                        <Button type="submit" disabled={loading || !selectedContactId || loadingContacts}>
                            {loading ? 'Logging...' : 'Log Activity'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
