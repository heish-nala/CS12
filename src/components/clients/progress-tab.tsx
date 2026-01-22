'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, DataColumn, DataRow, PeriodData, TimeTrackingConfig } from '@/lib/db/types';
import { MonthCard } from './month-card';
import {
    Search,
    LayoutGrid,
    List,
    Table2,
    Users,
    BarChart3,
    Loader2,
    Save,
    Clock,
    Mail,
    Phone,
} from 'lucide-react';
import { toast } from 'sonner';

interface DataTableWithMeta extends DataTable {
    columns: DataColumn[];
    rows: DataRow[];
    row_count: number;
    time_tracking: TimeTrackingConfig | null;
}

interface ContactWithProgress {
    id: string;
    rowId: string;
    tableId: string;
    name: string;
    email?: string;
    phone?: string;
    tableName: string;
    currentPeriodTotal?: number;
    currentPeriodLabel?: string;
    previousPeriodTotal?: number;
    lastUpdated?: string;
    metricsSummary?: Record<string, number>; // metric name -> value for current period
}

type ViewMode = 'cards' | 'table' | 'grid';

interface ProgressTabProps {
    clientId: string;
}

export function ProgressTab({ clientId }: ProgressTabProps) {
    const [tables, setTables] = useState<DataTableWithMeta[]>([]);
    const [contacts, setContacts] = useState<ContactWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('cards');

    // Panel state
    const [selectedContact, setSelectedContact] = useState<ContactWithProgress | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [periodData, setPeriodData] = useState<PeriodData[]>([]);
    const [loadingPeriods, setLoadingPeriods] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, number>>>({});
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Track in-flight requests
    const pendingRequestsRef = useRef<Set<string>>(new Set());

    // Fetch tables and contacts on mount
    useEffect(() => {
        fetchData();
    }, [clientId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/data-tables?client_id=${clientId}`);
            const data = await response.json();
            const allTables = (data.tables || []) as DataTableWithMeta[];

            // Filter to tables with time tracking
            const timeTrackingTables = allTables.filter(t => t.time_tracking?.enabled);
            setTables(timeTrackingTables);

            // Build contacts list from all time-tracking tables
            const allContacts: ContactWithProgress[] = [];

            for (const table of timeTrackingTables) {
                // Fetch full table data if not already loaded
                let tableData = table;
                if (!table.rows || table.rows.length === 0) {
                    const tableResponse = await fetch(`/api/data-tables/${table.id}`);
                    const tableJson = await tableResponse.json();
                    tableData = { ...table, ...tableJson.table };
                }

                // Fetch period data for all rows in this table
                let periodsByRow: Record<string, PeriodData[]> = {};
                try {
                    const periodsResponse = await fetch(`/api/data-tables/${table.id}/periods/batch`);
                    periodsByRow = await periodsResponse.json();
                } catch (e) {
                    console.error('Error fetching periods batch:', e);
                }

                const columns = tableData.columns || [];
                const primaryColumn = columns.find(c => c.is_primary);
                const nameColumnId = primaryColumn?.id || columns[0]?.id;
                const emailColumn = columns.find(c => c.type === 'email');
                const phoneColumn = columns.find(c => c.type === 'phone');
                const metrics = tableData.time_tracking?.metrics || [];

                for (const row of tableData.rows || []) {
                    const name = row.data?.[nameColumnId];
                    if (!name) continue;

                    // Find current and previous period for this row
                    const rowPeriods = periodsByRow[row.id] || [];
                    const today = new Date();
                    const currentPeriodIdx = rowPeriods.findIndex(p => {
                        // Parse dates with noon time to avoid timezone issues
                        const start = new Date(p.period_start + 'T12:00:00');
                        const end = new Date(p.period_end + 'T12:00:00');
                        return today >= start && today <= end;
                    });

                    const currentPeriod = currentPeriodIdx >= 0 ? rowPeriods[currentPeriodIdx] : null;
                    const previousPeriod = currentPeriodIdx > 0 ? rowPeriods[currentPeriodIdx - 1] : null;

                    // Calculate totals
                    const calcTotal = (p: PeriodData | null) => {
                        if (!p?.metrics) return 0;
                        return Object.values(p.metrics).reduce((sum, val) => sum + (val || 0), 0);
                    };

                    // Build metrics summary with names
                    const metricsSummary: Record<string, number> = {};
                    if (currentPeriod?.metrics) {
                        for (const metric of metrics) {
                            metricsSummary[metric.name] = currentPeriod.metrics[metric.id] || 0;
                        }
                    }

                    allContacts.push({
                        id: `${table.id}-${row.id}`,
                        rowId: row.id,
                        tableId: table.id,
                        name: String(name),
                        email: emailColumn ? String(row.data?.[emailColumn.id] || '') : undefined,
                        phone: phoneColumn ? String(row.data?.[phoneColumn.id] || '') : undefined,
                        tableName: table.name,
                        lastUpdated: row.updated_at,
                        currentPeriodTotal: calcTotal(currentPeriod),
                        currentPeriodLabel: currentPeriod?.period_label,
                        previousPeriodTotal: calcTotal(previousPeriod),
                        metricsSummary,
                    });
                }
            }

            setContacts(allContacts);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch period data when panel opens
    const fetchPeriodData = async (tableId: string, rowId: string) => {
        const requestKey = `periods-${tableId}-${rowId}`;
        if (pendingRequestsRef.current.has(requestKey)) return;
        pendingRequestsRef.current.add(requestKey);

        setLoadingPeriods(true);
        try {
            const response = await fetch(`/api/data-tables/${tableId}/rows/${rowId}/periods`);
            const data = await response.json();
            setPeriodData(data || []);
        } catch (error) {
            console.error('Error fetching periods:', error);
            setPeriodData([]);
        } finally {
            pendingRequestsRef.current.delete(requestKey);
            setLoadingPeriods(false);
        }
    };

    // Handle contact click
    const handleContactClick = (contact: ContactWithProgress) => {
        setSelectedContact(contact);
        setPanelOpen(true);
        setPendingChanges({});
        fetchPeriodData(contact.tableId, contact.rowId);
    };

    // Get active table for selected contact
    const activeTable = selectedContact
        ? tables.find(t => t.id === selectedContact.tableId)
        : null;
    const metrics = activeTable?.time_tracking?.metrics || [];

    // Handle metric change
    const handleMetricChange = (periodId: string, metricId: string, value: number) => {
        setPendingChanges(prev => ({
            ...prev,
            [periodId]: { ...(prev[periodId] || {}), [metricId]: value },
        }));
        setPeriodData(prev =>
            prev.map(p => p.id === periodId ? { ...p, metrics: { ...p.metrics, [metricId]: value } } : p)
        );
    };

    // Save changes
    const handleSave = async () => {
        if (!selectedContact || Object.keys(pendingChanges).length === 0) {
            toast.info('No changes to save');
            return;
        }

        setSaving(true);
        try {
            const savePromises = Object.entries(pendingChanges).map(
                async ([periodId, metrics]) => {
                    const response = await fetch(
                        `/api/data-tables/${selectedContact.tableId}/rows/${selectedContact.rowId}/periods/${periodId}`,
                        {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ metrics }),
                        }
                    );
                    if (!response.ok) throw new Error(`Failed to save period ${periodId}`);
                    return response.json();
                }
            );

            await Promise.all(savePromises);
            setPendingChanges({});
            toast.success('Changes saved');
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    // Filter contacts
    const filteredContacts = useMemo(() => {
        if (!searchQuery.trim()) return contacts;
        const query = searchQuery.toLowerCase();
        return contacts.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.email?.toLowerCase().includes(query) ||
            c.tableName.toLowerCase().includes(query)
        );
    }, [contacts, searchQuery]);

    // Format last updated
    const formatLastUpdated = (dateStr?: string) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const hasPendingChanges = Object.keys(pendingChanges).length > 0;

    // Handle panel close with unsaved changes check
    const handlePanelClose = (open: boolean) => {
        if (!open && hasPendingChanges) {
            setShowCloseConfirm(true);
        } else {
            setPanelOpen(open);
        }
    };

    const confirmClose = () => {
        setShowCloseConfirm(false);
        setPendingChanges({});
        setPanelOpen(false);
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

    // No time tracking tables
    if (tables.length === 0) {
        return (
            <div className="border border-dashed border-border/60 rounded-lg">
                <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="rounded-full bg-muted/60 p-5 mb-4">
                        <BarChart3 className="h-10 w-10 text-muted-foreground/60" />
                    </div>
                    <h3 className="text-base font-semibold mb-1.5">No progress tracking enabled</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                        Enable progress tracking on a data table to use this feature.
                        Go to the Data tab and configure progress tracking on a table.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">Progress</h3>
                    <span className="text-sm text-muted-foreground">
                        {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-64"
                        />
                    </div>
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
                        {searchQuery ? 'Try a different search term' : 'Add contacts in the Data tab'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Cards View */}
                    {viewMode === 'cards' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredContacts.map((contact) => {
                                const deltaPercent = contact.previousPeriodTotal && contact.previousPeriodTotal > 0
                                    ? Math.round(((contact.currentPeriodTotal || 0) - contact.previousPeriodTotal) / contact.previousPeriodTotal * 100)
                                    : null;

                                return (
                                    <button
                                        key={contact.id}
                                        onClick={() => handleContactClick(contact)}
                                        className="text-left p-4 border rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="font-medium">{contact.name}</h4>
                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                                {contact.tableName}
                                            </span>
                                        </div>

                                        {/* Progress Summary */}
                                        {contact.currentPeriodLabel && (
                                            <div className="mb-3 p-2 bg-muted/50 rounded">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-muted-foreground">{contact.currentPeriodLabel}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-semibold">{contact.currentPeriodTotal || 0}</span>
                                                        {deltaPercent !== null && (
                                                            <span className={`text-xs ${deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {deltaPercent >= 0 ? '+' : ''}{deltaPercent}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {contact.metricsSummary && Object.keys(contact.metricsSummary).length > 0 && (
                                                    <div className="flex gap-2 flex-wrap">
                                                        {Object.entries(contact.metricsSummary).map(([name, value]) => (
                                                            <span key={name} className="text-xs text-muted-foreground">
                                                                {name}: <span className="font-medium text-foreground">{value}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-1.5 text-sm text-muted-foreground">
                                            {contact.email && (
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-3.5 w-3.5" />
                                                    <span className="truncate">{contact.email}</span>
                                                </div>
                                            )}
                                            {contact.phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone className="h-3.5 w-3.5" />
                                                    <span>{contact.phone}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span>Updated {formatLastUpdated(contact.lastUpdated)}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Table View */}
                    {viewMode === 'table' && (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Name</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Current Period</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Total</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Change</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium">Last Updated</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredContacts.map((contact) => {
                                        const deltaPercent = contact.previousPeriodTotal && contact.previousPeriodTotal > 0
                                            ? Math.round(((contact.currentPeriodTotal || 0) - contact.previousPeriodTotal) / contact.previousPeriodTotal * 100)
                                            : null;

                                        return (
                                            <tr
                                                key={contact.id}
                                                onClick={() => handleContactClick(contact)}
                                                className="hover:bg-muted/30 cursor-pointer transition-colors"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{contact.name}</div>
                                                    {contact.email && (
                                                        <div className="text-xs text-muted-foreground">{contact.email}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {contact.currentPeriodLabel || '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-semibold">{contact.currentPeriodTotal || 0}</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {deltaPercent !== null ? (
                                                        <span className={deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                            {deltaPercent >= 0 ? '+' : ''}{deltaPercent}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {formatLastUpdated(contact.lastUpdated)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Grid View */}
                    {viewMode === 'grid' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {filteredContacts.map((contact) => {
                                const deltaPercent = contact.previousPeriodTotal && contact.previousPeriodTotal > 0
                                    ? Math.round(((contact.currentPeriodTotal || 0) - contact.previousPeriodTotal) / contact.previousPeriodTotal * 100)
                                    : null;

                                return (
                                    <button
                                        key={contact.id}
                                        onClick={() => handleContactClick(contact)}
                                        className="text-left p-3 border rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors"
                                    >
                                        <h4 className="font-medium text-sm truncate">{contact.name}</h4>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-lg font-semibold">{contact.currentPeriodTotal || 0}</span>
                                            {deltaPercent !== null && (
                                                <span className={`text-xs ${deltaPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {deltaPercent >= 0 ? '+' : ''}{deltaPercent}%
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {contact.currentPeriodLabel || formatLastUpdated(contact.lastUpdated)}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Progress Detail Panel */}
            <Sheet open={panelOpen} onOpenChange={handlePanelClose}>
                <SheetContent className="sm:max-w-lg">
                    <SheetHeader className="pb-4">
                        <SheetTitle>{selectedContact?.name}</SheetTitle>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                            {selectedContact?.email && (
                                <span className="flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5" />
                                    {selectedContact.email}
                                </span>
                            )}
                            {selectedContact?.phone && (
                                <span className="flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5" />
                                    {selectedContact.phone}
                                </span>
                            )}
                        </div>
                    </SheetHeader>

                    {loadingPeriods ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : periodData.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No period data available</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-[calc(100vh-120px)]">
                            {/* Scrollable Timeline */}
                            <div
                                className="flex-1 overflow-y-auto space-y-2 pr-2 min-h-0"
                                ref={(el) => {
                                    if (el && !loadingPeriods) {
                                        el.scrollTop = el.scrollHeight;
                                    }
                                }}
                            >
                                {/* Order: Jan 2025 at top ... Dec 2025 ... Jan 2026 at bottom */}
                                {periodData.map((period, idx) => {
                                    const previousPeriod = idx > 0 ? periodData[idx - 1] : null;
                                    const today = new Date();
                                    // Parse dates with noon time to avoid timezone issues
                                    const start = new Date(period.period_start + 'T12:00:00');
                                    const end = new Date(period.period_end + 'T12:00:00');
                                    const isCurrent = today >= start && today <= end;

                                    return (
                                        <MonthCard
                                            key={period.id}
                                            period={period}
                                            previousPeriod={previousPeriod}
                                            metrics={metrics}
                                            isEditable={true}
                                            isCurrent={isCurrent}
                                            onChange={(metricId, value) => {
                                                handleMetricChange(period.id, metricId, value);
                                            }}
                                        />
                                    );
                                })}
                            </div>

                            {/* Save Button */}
                            <Button
                                onClick={handleSave}
                                disabled={!hasPendingChanges || saving}
                                className="w-full gap-2 mt-4 shrink-0"
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                {hasPendingChanges ? 'Save Changes' : 'No Changes'}
                            </Button>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Unsaved Changes Confirmation Dialog */}
            <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Unsaved changes</DialogTitle>
                        <DialogDescription>
                            You have unsaved changes. Are you sure you want to close without saving?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCloseConfirm(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmClose}>
                            Discard changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
