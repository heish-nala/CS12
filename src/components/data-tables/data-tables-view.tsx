'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { DataTable, DataColumn, DataRow, ColumnType, PeriodData, TimeTrackingConfig } from '@/lib/db/types';
import { DataGrid } from './data-grid';
import { DownloadReportDialog } from './download-report-dialog';
import { TimeTrackingConfigDialog } from './time-tracking-config-dialog';
import { ImportCSVDialog } from './import-csv-dialog';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Plus,
    MoreHorizontal,
    Trash2,
    Edit,
    Users,
    Download,
    Upload,
    BarChart3,
    FileSpreadsheet,
} from 'lucide-react';

const STORAGE_KEY_PREFIX = 'activity-contact-source-';

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

interface DataTableWithMeta extends DataTable {
    columns: DataColumn[];
    rows: DataRow[];
    row_count: number;
    time_tracking: TimeTrackingConfig | null;
}

interface DataTablesViewProps {
    clientId: string;
}

export function DataTablesView({ clientId }: DataTablesViewProps) {
    const { user } = useAuth();
    const [tables, setTables] = useState<DataTableWithMeta[]>([]);
    const [activeTableId, setActiveTableId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
    const [isCreatingBlankList, setIsCreatingBlankList] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [timeTrackingDialogOpen, setTimeTrackingDialogOpen] = useState(false);
    const [selectedTableForConfig, setSelectedTableForConfig] = useState<DataTableWithMeta | null>(null);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [tableToRename, setTableToRename] = useState<DataTableWithMeta | null>(null);
    const [newTableName, setNewTableName] = useState('');

    // Period data state (used by download report)
    const [periodData, setPeriodData] = useState<Record<string, PeriodData[]>>({});

    // Loading states for better UX
    const [isAddingRow, setIsAddingRow] = useState(false);
    const [isAddingColumn, setIsAddingColumn] = useState(false);

    // Track which tables have been fully loaded (for tab caching)
    const loadedTablesRef = useRef<Set<string>>(new Set());

    // Track in-flight requests to prevent duplicates
    const pendingRequestsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        fetchTables();
    }, [clientId]);

    const autoSaveContactSourceConfig = (table: DataTableWithMeta) => {
        // Only auto-save if no config exists
        const existingConfig = localStorage.getItem(`${STORAGE_KEY_PREFIX}${clientId}`);
        if (existingConfig) return;

        const detected = detectContactColumns(table.columns);
        if (detected.nameColumnId) {
            const config = {
                tableId: table.id,
                tableName: table.name,
                nameColumnId: detected.nameColumnId,
                emailColumnId: detected.emailColumnId,
                phoneColumnId: detected.phoneColumnId,
            };
            localStorage.setItem(`${STORAGE_KEY_PREFIX}${clientId}`, JSON.stringify(config));
        }
    };

    const fetchTables = async () => {
        const requestKey = `tables-${clientId}`;

        // Skip if request is already in flight
        if (pendingRequestsRef.current.has(requestKey)) {
            return;
        }

        pendingRequestsRef.current.add(requestKey);

        try {
            const userIdParam = user?.id ? `&user_id=${user.id}` : '';
            const response = await fetch(`/api/data-tables?client_id=${clientId}${userIdParam}`);
            const data = await response.json();
            const tablesWithData = data.tables || [];
            setTables(tablesWithData);

            // Auto-detect contact columns for first table if no config exists
            if (tablesWithData.length > 0) {
                autoSaveContactSourceConfig(tablesWithData[0]);
            }

            // Set active table to first one if not set or if current one doesn't exist
            const currentTableExists = tablesWithData.some((t: DataTableWithMeta) => t.id === activeTableId);
            if ((!activeTableId || !currentTableExists) && tablesWithData.length > 0) {
                setActiveTableId(tablesWithData[0].id);
                // Fetch full data for first table
                fetchTableData(tablesWithData[0].id);
            } else if (activeTableId && currentTableExists) {
                // Refresh data for current table
                fetchTableData(activeTableId);
            }
        } catch (error) {
            console.error('Error fetching tables:', error);
        } finally {
            pendingRequestsRef.current.delete(requestKey);
            setLoading(false);
        }
    };

    const fetchTableData = async (tableId: string, force = false) => {
        // Skip if already loaded and not forcing refresh
        if (!force && loadedTablesRef.current.has(tableId)) {
            return;
        }

        const requestKey = `table-${tableId}`;

        // Skip if request is already in flight
        if (pendingRequestsRef.current.has(requestKey)) {
            return;
        }

        pendingRequestsRef.current.add(requestKey);

        try {
            const userIdParam = user?.id ? `?user_id=${user.id}` : '';
            const response = await fetch(`/api/data-tables/${tableId}${userIdParam}`);
            const data = await response.json();

            setTables((prev) =>
                prev.map((t) =>
                    t.id === tableId
                        ? { ...t, columns: data.table.columns, rows: data.table.rows }
                        : t
                )
            );

            // Mark as loaded
            loadedTablesRef.current.add(tableId);
        } catch (error) {
            console.error('Error fetching table data:', error);
        } finally {
            pendingRequestsRef.current.delete(requestKey);
        }
    };

    const handleAddRow = async () => {
        if (!activeTableId || isAddingRow) return;

        setIsAddingRow(true);

        try {
            const response = await fetch(`/api/data-tables/${activeTableId}/rows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: {}, user_id: user?.id }),
            });

            if (response.ok) {
                const { row } = await response.json();
                // Optimistic append - no refetch needed
                setTables((prev) =>
                    prev.map((t) =>
                        t.id === activeTableId
                            ? { ...t, rows: [...t.rows, row], row_count: (t.row_count || 0) + 1 }
                            : t
                    )
                );
            }
        } catch (error) {
            console.error('Error adding row:', error);
        } finally {
            setIsAddingRow(false);
        }
    };

    // Debounced row update to prevent rapid API calls during inline editing
    const debouncedUpdateRow = useDebouncedCallback(
        async (rowId: string, data: Record<string, any>, tableId: string) => {
            try {
                await fetch(`/api/data-tables/${tableId}/rows/${rowId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data }),
                });
            } catch (error) {
                console.error('Error updating row:', error);
            }
        },
        300
    );

    const handleUpdateRow = useCallback((rowId: string, data: Record<string, any>) => {
        if (!activeTableId) return;

        // Optimistic update first - instant UI feedback
        setTables((prev) =>
            prev.map((t) =>
                t.id === activeTableId
                    ? {
                        ...t,
                        rows: t.rows.map((r) =>
                            r.id === rowId ? { ...r, data: { ...r.data, ...data } } : r
                        ),
                    }
                    : t
            )
        );

        // Debounced API call
        debouncedUpdateRow(rowId, data, activeTableId);
    }, [activeTableId, debouncedUpdateRow]);

    const handleDeleteRow = async (rowId: string) => {
        if (!activeTableId) return;

        // Optimistic delete first
        setTables((prev) =>
            prev.map((t) =>
                t.id === activeTableId
                    ? { ...t, rows: t.rows.filter((r) => r.id !== rowId), row_count: Math.max(0, (t.row_count || 0) - 1) }
                    : t
            )
        );

        try {
            await fetch(`/api/data-tables/${activeTableId}/rows/${rowId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Error deleting row:', error);
            // Could revert here if needed
        }
    };

    const handleAddColumn = async (name: string, type: ColumnType) => {
        if (!activeTableId || isAddingColumn) return;

        setIsAddingColumn(true);

        try {
            const response = await fetch(`/api/data-tables/${activeTableId}/columns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type }),
            });

            if (response.ok) {
                const { column } = await response.json();
                // Optimistic append - no refetch needed
                setTables((prev) =>
                    prev.map((t) =>
                        t.id === activeTableId
                            ? { ...t, columns: [...t.columns, column] }
                            : t
                    )
                );
            }
        } catch (error) {
            console.error('Error adding column:', error);
        } finally {
            setIsAddingColumn(false);
        }
    };

    const handleUpdateColumn = async (columnId: string, updates: Partial<DataColumn>) => {
        if (!activeTableId) return;

        // Optimistic update first
        setTables((prev) =>
            prev.map((t) =>
                t.id === activeTableId
                    ? {
                        ...t,
                        columns: t.columns.map((c) =>
                            c.id === columnId ? { ...c, ...updates } : c
                        ),
                    }
                    : t
            )
        );

        try {
            await fetch(`/api/data-tables/${activeTableId}/columns/${columnId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        } catch (error) {
            console.error('Error updating column:', error);
            // Could revert here if needed
        }
    };

    const handleDeleteColumn = async (columnId: string) => {
        if (!activeTableId) return;

        // Optimistic delete first
        setTables((prev) =>
            prev.map((t) =>
                t.id === activeTableId
                    ? { ...t, columns: t.columns.filter((c) => c.id !== columnId) }
                    : t
            )
        );

        try {
            await fetch(`/api/data-tables/${activeTableId}/columns/${columnId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Error deleting column:', error);
            // Could revert here if needed
        }
    };

    const handleDeleteTable = async (tableId: string) => {
        try {
            await fetch(`/api/data-tables/${tableId}`, {
                method: 'DELETE',
            });

            setTables((prev) => prev.filter((t) => t.id !== tableId));

            if (activeTableId === tableId) {
                const remaining = tables.filter((t) => t.id !== tableId);
                setActiveTableId(remaining.length > 0 ? remaining[0].id : null);
            }
        } catch (error) {
            console.error('Error deleting table:', error);
        }
    };

    const handleOpenRenameDialog = (table: DataTableWithMeta) => {
        setTableToRename(table);
        setNewTableName(table.name);
        setRenameDialogOpen(true);
    };

    const handleRenameTable = async () => {
        if (!tableToRename || !newTableName.trim()) return;

        try {
            const response = await fetch(`/api/data-tables/${tableToRename.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTableName.trim() }),
            });

            if (response.ok) {
                setTables((prev) =>
                    prev.map((t) =>
                        t.id === tableToRename.id
                            ? { ...t, name: newTableName.trim() }
                            : t
                    )
                );
                setRenameDialogOpen(false);
                setTableToRename(null);
                setNewTableName('');
            }
        } catch (error) {
            console.error('Error renaming table:', error);
        }
    };

    const handleOpenTimeTrackingConfig = (table: DataTableWithMeta) => {
        setSelectedTableForConfig(table);
        setTimeTrackingDialogOpen(true);
    };

    const handleUpdateTimeTracking = async (config: TimeTrackingConfig | null) => {
        if (!selectedTableForConfig) return;

        try {
            const response = await fetch(`/api/data-tables/${selectedTableForConfig.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ time_tracking: config }),
            });

            if (response.ok) {
                // Update local state
                setTables((prev) =>
                    prev.map((t) =>
                        t.id === selectedTableForConfig.id
                            ? { ...t, time_tracking: config }
                            : t
                    )
                );

                // Clear cached period data so it gets refetched with new frequency
                setPeriodData({});

                // Refetch period data for all rows in this table (skip enabled check since we know config is enabled)
                if (config?.enabled && selectedTableForConfig.rows) {
                    await fetchPeriodData(selectedTableForConfig.id, selectedTableForConfig.rows, true);
                }
            }
        } catch (error) {
            console.error('Error updating time tracking:', error);
        }
    };

    // Fetch period data for all rows in a table
    const fetchPeriodData = async (tableId: string, rows: DataRow[], skipEnabledCheck = false) => {
        if (!skipEnabledCheck) {
            const table = tables.find(t => t.id === tableId);
            if (!table?.time_tracking?.enabled) return;
        }

        const requestKey = `periods-${tableId}`;

        // Skip if request is already in flight
        if (pendingRequestsRef.current.has(requestKey)) {
            return;
        }

        pendingRequestsRef.current.add(requestKey);

        try {
            // Use batch endpoint to fetch all periods in a single request
            const userIdParam = user?.id ? `?user_id=${user.id}` : '';
            const response = await fetch(`/api/data-tables/${tableId}/periods/batch${userIdParam}`);
            const groupedPeriods = await response.json();

            // Initialize empty arrays for rows that don't have periods yet
            const newPeriodData: Record<string, PeriodData[]> = {};
            for (const row of rows) {
                newPeriodData[row.id] = groupedPeriods[row.id] || [];
            }

            setPeriodData(newPeriodData);
        } catch (error) {
            console.error('Error fetching period data:', error);
            // Initialize empty arrays on error
            const emptyPeriodData: Record<string, PeriodData[]> = {};
            for (const row of rows) {
                emptyPeriodData[row.id] = [];
            }
            setPeriodData(emptyPeriodData);
        } finally {
            pendingRequestsRef.current.delete(requestKey);
        }
    };

    const activeTable = tables.length > 0 ? tables[0] : null;

    // Always use first table as active (single-table mode)
    useEffect(() => {
        if (tables.length > 0 && activeTableId !== tables[0].id) {
            setActiveTableId(tables[0].id);
        }
    }, [tables, activeTableId]);

    // Fetch period data when active table changes and has time tracking
    useEffect(() => {
        if (activeTable?.time_tracking?.enabled && activeTable.rows?.length) {
            fetchPeriodData(activeTable.id, activeTable.rows);
        }
    }, [activeTableId, activeTable?.rows?.length]);

    const createBlankAttendeeList = async () => {
        setIsCreatingBlankList(true);
        try {
            const response = await fetch('/api/data-tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    type: 'attendee_list',
                    user_id: user?.id,
                }),
            });

            if (response.ok) {
                fetchTables();
            }
        } catch (error) {
            console.error('Error creating table:', error);
        } finally {
            setIsCreatingBlankList(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {/* Header skeleton */}
                <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                        <div className="h-5 w-5 bg-muted/40 animate-pulse rounded" />
                        <div className="h-6 w-32 bg-muted/40 animate-pulse rounded" />
                        <div className="h-5 w-8 bg-muted/30 animate-pulse rounded" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-8 w-24 bg-muted/30 animate-pulse rounded" />
                    </div>
                </div>
                {/* Table skeleton matching actual structure */}
                <div className="table-skeleton">
                    <div className="table-skeleton-header">
                        <div className="table-skeleton-cell w-8" />
                        <div className="table-skeleton-cell flex-1 max-w-[120px]" />
                        <div className="table-skeleton-cell flex-1 max-w-[100px]" />
                        <div className="table-skeleton-cell flex-1 max-w-[80px]" />
                    </div>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="table-skeleton-row" style={{ opacity: 1 - i * 0.15 }}>
                            <div className="table-skeleton-cell w-8" />
                            <div className="table-skeleton-cell flex-1 max-w-[120px]" />
                            <div className="table-skeleton-cell flex-1 max-w-[100px]" />
                            <div className="table-skeleton-cell flex-1 max-w-[80px]" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Empty state
    if (tables.length === 0) {
        return (
            <div className="border border-dashed border-border/60 rounded-lg content-loaded mb-6">
                <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="rounded-full bg-muted/60 p-5 mb-4">
                        <Users className="h-10 w-10 text-muted-foreground/60" />
                    </div>

                    <h3 className="text-base font-semibold mb-1.5 text-foreground">
                        No attendees yet
                    </h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                        Add your attendees with Name, Email, and Phone. We'll automatically track their Blueprint progress and Status.
                    </p>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={createBlankAttendeeList}
                            disabled={isCreatingBlankList}
                            data-onboarding="add-table-btn"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Blank List
                        </Button>
                        <Button onClick={() => setImportDialogOpen(true)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Upload CSV
                        </Button>
                    </div>
                </div>

                {/* Import CSV Dialog for empty state */}
                <ImportCSVDialog
                    open={importDialogOpen}
                    onOpenChange={setImportDialogOpen}
                    tableId=""
                    tableName="Attendee List"
                    clientId={clientId}
                    isNewTable={true}
                    onImportComplete={() => {
                        fetchTables();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4 content-loaded pb-6">
            {/* Simplified Header */}
            <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">Attendee List</h3>
                    <span className="text-sm text-muted-foreground">
                        {activeTable?.row_count || activeTable?.rows?.length || 0}
                    </span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-6 w-6 p-0 hover:bg-muted rounded flex items-center justify-center">
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => activeTable && handleOpenRenameDialog(activeTable)}>
                                <Edit className="h-3.5 w-3.5 mr-2" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => activeTable && handleOpenTimeTrackingConfig(activeTable)}>
                                <BarChart3 className="h-3.5 w-3.5 mr-2" />
                                Progress Tracking
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => activeTable && handleDeleteTable(activeTable.id)}
                                className="text-destructive"
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setImportDialogOpen(true)}
                    >
                        <Upload className="h-4 w-4 mr-1" />
                        Import CSV
                    </Button>
                    {activeTable?.time_tracking?.enabled && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDownloadDialogOpen(true)}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            Download Report
                        </Button>
                    )}
                </div>
            </div>

            {/* Active Table Content */}
            {activeTable && (
                <>
                    {/* Show skeleton while row data is loading */}
                    {(!activeTable.rows || activeTable.rows.length === 0) && (activeTable.row_count || 0) > 0 ? (
                        <div className="table-skeleton">
                            <div className="table-skeleton-header">
                                <div className="table-skeleton-cell w-8" />
                                {(activeTable.columns || []).slice(0, 4).map((_, i) => (
                                    <div key={i} className="table-skeleton-cell flex-1 max-w-[120px]" />
                                ))}
                            </div>
                            {[...Array(Math.min(activeTable.row_count || 5, 10))].map((_, i) => (
                                <div key={i} className="table-skeleton-row" style={{ opacity: 1 - i * 0.08 }}>
                                    <div className="table-skeleton-cell w-8" />
                                    {(activeTable.columns || []).slice(0, 4).map((_, j) => (
                                        <div key={j} className="table-skeleton-cell flex-1 max-w-[120px]" />
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <DataGrid
                            tableId={activeTable.id}
                            columns={activeTable.columns || []}
                            rows={activeTable.rows || []}
                            onAddRow={handleAddRow}
                            onUpdateRow={handleUpdateRow}
                            onDeleteRow={handleDeleteRow}
                            onAddColumn={handleAddColumn}
                            onUpdateColumn={handleUpdateColumn}
                            onDeleteColumn={handleDeleteColumn}
                            timeTracking={activeTable.time_tracking}
                            periodData={periodData}
                            onConfigureTimeTracking={() => handleOpenTimeTrackingConfig(activeTable)}
                            isAddingRow={isAddingRow}
                            isAddingColumn={isAddingColumn}
                        />
                    )}
                </>
            )}

            {/* Download Report Dialog */}
            {activeTable && (
                <DownloadReportDialog
                    open={downloadDialogOpen}
                    onOpenChange={setDownloadDialogOpen}
                    tableName={activeTable.name}
                    columns={activeTable.columns || []}
                    rows={activeTable.rows || []}
                    timeTracking={activeTable.time_tracking}
                    periodData={periodData}
                />
            )}

            {/* Time Tracking Config Dialog */}
            {selectedTableForConfig && (
                <TimeTrackingConfigDialog
                    open={timeTrackingDialogOpen}
                    onOpenChange={setTimeTrackingDialogOpen}
                    config={selectedTableForConfig.time_tracking}
                    onSave={handleUpdateTimeTracking}
                    tableName={selectedTableForConfig.name}
                />
            )}

            {/* Import CSV Dialog */}
            {activeTable && (
                <ImportCSVDialog
                    open={importDialogOpen}
                    onOpenChange={setImportDialogOpen}
                    tableId={activeTable.id}
                    tableName={activeTable.name}
                    onImportComplete={() => {
                        fetchTableData(activeTable.id, true);
                    }}
                />
            )}

            {/* Rename Table Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Rename List</DialogTitle>
                        <DialogDescription>
                            Enter a new name for this attendee list.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={newTableName}
                            onChange={(e) => setNewTableName(e.target.value)}
                            placeholder="List name"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRenameTable();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRenameDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRenameTable}
                            disabled={!newTableName.trim()}
                        >
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
