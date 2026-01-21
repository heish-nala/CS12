'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, DataTable, DataColumn, DataRow } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
    Phone,
    Mail,
    Clock,
    LayoutGrid,
    List,
    Table2,
    Search,
    Users,
    Copy,
    Check,
} from 'lucide-react';
import { PersonDetailPanel, PersonInfo } from '@/components/person-detail-panel';

interface ActivityTimelineProps {
    clientId: string;
}

type ViewMode = 'cards' | 'table' | 'grid';

interface ContactWithActivity {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    tableId?: string;
    tableName?: string;
    lastActivityDate?: string;
    activityCount: number;
}

export function ActivityTimeline({ clientId }: ActivityTimelineProps) {
    const [contacts, setContacts] = useState<ContactWithActivity[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('cards');
    const [searchQuery, setSearchQuery] = useState('');

    // Panel state
    const [selectedPerson, setSelectedPerson] = useState<PersonInfo | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);

    // Copy state
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = async (e: React.MouseEvent, text: string, id: string) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch contacts and activities in parallel
            const [contactsData, activitiesData] = await Promise.all([
                fetchContacts(),
                fetchActivities()
            ]);

            // Merge activity data into contacts
            const contactsWithActivity = contactsData.map(contact => {
                const contactActivities = activitiesData.filter(
                    a => a.contact_name === contact.name
                );
                const lastActivity = contactActivities.length > 0
                    ? contactActivities.sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      )[0]
                    : null;

                return {
                    ...contact,
                    lastActivityDate: lastActivity?.created_at,
                    activityCount: contactActivities.length,
                };
            });

            setContacts(contactsWithActivity);
            setActivities(activitiesData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivities = async (): Promise<Activity[]> => {
        try {
            const response = await fetch('/api/activities');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
        }
        return [];
    };

    const fetchContacts = async (): Promise<ContactWithActivity[]> => {
        const allContacts: ContactWithActivity[] = [];

        try {
            // Fetch tables and doctors in parallel
            const [tablesResponse, doctorsResponse] = await Promise.all([
                fetch(`/api/data-tables?client_id=${clientId}`),
                fetch(`/api/doctors?dso_id=${clientId}`)
            ]);

            // Process tables response
            if (tablesResponse.ok) {
                const { tables } = await tablesResponse.json();

                const rowsPromises = tables.map(async (table: DataTable & { columns?: DataColumn[] }) => {
                    const columns: DataColumn[] = table.columns || [];
                    const primaryColumn = columns.find(c => c.is_primary);

                    // If no primary column, try to find a "name" column
                    const nameColumn = primaryColumn || columns.find(c =>
                        c.name.toLowerCase().includes('name') && c.type === 'text'
                    ) || columns.find(c => c.type === 'text');

                    if (!nameColumn) return [];

                    try {
                        const rowsResponse = await fetch(`/api/data-tables/${table.id}/rows`);
                        if (!rowsResponse.ok) return [];

                        const { rows } = await rowsResponse.json();
                        const emailColumn = columns.find(c => c.type === 'email');
                        const phoneColumn = columns.find(c => c.type === 'phone');

                        return rows
                            .filter((row: DataRow) => row.data[nameColumn.id])
                            .map((row: DataRow) => ({
                                id: `table-${table.id}-row-${row.id}`,
                                name: String(row.data[nameColumn.id]),
                                email: emailColumn ? String(row.data[emailColumn.id] || '') : undefined,
                                phone: phoneColumn ? String(row.data[phoneColumn.id] || '') : undefined,
                                tableId: table.id,
                                tableName: table.name,
                                activityCount: 0,
                            }));
                    } catch {
                        return [];
                    }
                });

                const tableContacts = await Promise.all(rowsPromises);
                allContacts.push(...tableContacts.flat());
            }

            // Process doctors response
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
                        activityCount: 0,
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
        }

        return allContacts;
    };

    const filteredContacts = useMemo(() => {
        if (!searchQuery.trim()) return contacts;

        const query = searchQuery.toLowerCase();
        return contacts.filter(contact =>
            contact.name.toLowerCase().includes(query) ||
            contact.email?.toLowerCase().includes(query) ||
            contact.phone?.toLowerCase().includes(query) ||
            contact.tableName?.toLowerCase().includes(query)
        );
    }, [contacts, searchQuery]);

    const handleContactClick = (contact: ContactWithActivity) => {
        const personInfo: PersonInfo = {
            id: contact.id,
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            source: contact.tableId ? 'data_row' : 'doctor',
            sourceId: contact.tableId,
        };
        setSelectedPerson(personInfo);
        setPanelOpen(true);
    };

    const formatLastActivity = (dateStr?: string) => {
        if (!dateStr) return 'No activity yet';

        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-10 w-64 bg-muted animate-pulse rounded" />
                    <div className="h-10 w-32 bg-muted animate-pulse rounded" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">Contacts</h3>
                    <span className="text-sm text-muted-foreground">
                        {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-64"
                        />
                    </div>

                    {/* View Toggle */}
                    <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
                        <ToggleGroupItem value="cards" aria-label="Cards view">
                            <LayoutGrid className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="table" aria-label="Table view">
                            <List className="h-4 w-4" />
                        </ToggleGroupItem>
                        <ToggleGroupItem value="grid" aria-label="Grid view">
                            <Table2 className="h-4 w-4" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </div>

            {/* Empty State */}
            {filteredContacts.length === 0 ? (
                <div className="text-center py-16 border border-dashed rounded-lg">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="font-medium text-muted-foreground">
                        {searchQuery ? 'No contacts found' : 'No contacts yet'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {searchQuery
                            ? 'Try a different search term'
                            : 'Add contacts in the Data tab to see them here'
                        }
                    </p>
                </div>
            ) : (
                <>
                    {/* Cards View */}
                    {viewMode === 'cards' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredContacts.map((contact) => (
                                <button
                                    key={contact.id}
                                    onClick={() => handleContactClick(contact)}
                                    className="text-left p-4 border rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <h4 className="font-medium">{contact.name}</h4>
                                        {contact.activityCount > 0 && (
                                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                {contact.activityCount} activities
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1.5 text-sm text-muted-foreground">
                                        {contact.email && (
                                            <div className="flex items-center gap-2 group/email">
                                                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span className="truncate flex-1">{contact.email}</span>
                                                <span
                                                    onClick={(e) => handleCopy(e, contact.email!, `email-${contact.id}`)}
                                                    className="opacity-0 group-hover/email:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                                                >
                                                    {copiedId === `email-${contact.id}` ? (
                                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                        {contact.phone && (
                                            <div className="flex items-center gap-2 group/phone">
                                                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span className="flex-1">{contact.phone}</span>
                                                <span
                                                    onClick={(e) => handleCopy(e, contact.phone!, `phone-${contact.id}`)}
                                                    className="opacity-0 group-hover/phone:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                                                >
                                                    {copiedId === `phone-${contact.id}` ? (
                                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-3.5 w-3.5" />
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-3.5 w-3.5" />
                                            <span>{formatLastActivity(contact.lastActivityDate)}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Table View */}
                    {viewMode === 'table' && (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Name</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Email</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Phone</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Last Activity</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Activities</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredContacts.map((contact) => (
                                        <tr
                                            key={contact.id}
                                            onClick={() => handleContactClick(contact)}
                                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-3 font-medium">{contact.name}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {contact.email ? (
                                                    <div className="flex items-center gap-2 group/email">
                                                        <span className="truncate">{contact.email}</span>
                                                        <span
                                                            onClick={(e) => handleCopy(e, contact.email!, `table-email-${contact.id}`)}
                                                            className="opacity-0 group-hover/email:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                                                        >
                                                            {copiedId === `table-email-${contact.id}` ? (
                                                                <Check className="h-3.5 w-3.5 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5" />
                                                            )}
                                                        </span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {contact.phone ? (
                                                    <div className="flex items-center gap-2 group/phone">
                                                        <span>{contact.phone}</span>
                                                        <span
                                                            onClick={(e) => handleCopy(e, contact.phone!, `table-phone-${contact.id}`)}
                                                            className="opacity-0 group-hover/phone:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                                                        >
                                                            {copiedId === `table-phone-${contact.id}` ? (
                                                                <Check className="h-3.5 w-3.5 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5" />
                                                            )}
                                                        </span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground">
                                                {formatLastActivity(contact.lastActivityDate)}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {contact.activityCount > 0 ? (
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                        {contact.activityCount}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">0</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Grid View (Compact) */}
                    {viewMode === 'grid' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {filteredContacts.map((contact) => (
                                <button
                                    key={contact.id}
                                    onClick={() => handleContactClick(contact)}
                                    className="text-left p-3 border rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                >
                                    <h4 className="font-medium text-sm truncate">{contact.name}</h4>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {formatLastActivity(contact.lastActivityDate)}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Person Detail Panel */}
            <PersonDetailPanel
                open={panelOpen}
                onOpenChange={setPanelOpen}
                person={selectedPerson}
                clientId={clientId}
            />
        </div>
    );
}
