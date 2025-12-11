'use client';

import { useState, useEffect } from 'react';
import { DataTable, DataColumn, DataRow, ColumnType, PeriodData, TimeTrackingConfig } from '@/lib/db/types';
import { DataGrid } from './data-grid';
import { CreateTableDialog } from './create-table-dialog';
import { PeriodDataDialog } from './period-data-dialog';
import { DownloadReportDialog } from './download-report-dialog';
import { TimeTrackingConfigDialog } from './time-tracking-config-dialog';
import { ImportCSVDialog } from './import-csv-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    UserRound,
    Building2,
    Users,
    MessageCircle,
    CheckSquare,
    Table,
    Database,
    Download,
    Upload,
    BarChart3,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
    'user-round': <UserRound className="h-4 w-4" />,
    'building-2': <Building2 className="h-4 w-4" />,
    'users': <Users className="h-4 w-4" />,
    'message-circle': <MessageCircle className="h-4 w-4" />,
    'check-square': <CheckSquare className="h-4 w-4" />,
    'table': <Table className="h-4 w-4" />,
};

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
    const [tables, setTables] = useState<DataTableWithMeta[]>([]);
    const [activeTableId, setActiveTableId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [timeTrackingDialogOpen, setTimeTrackingDialogOpen] = useState(false);
    const [selectedTableForConfig, setSelectedTableForConfig] = useState<DataTableWithMeta | null>(null);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [tableToRename, setTableToRename] = useState<DataTableWithMeta | null>(null);
    const [newTableName, setNewTableName] = useState('');

    // Period data state
    const [periodData, setPeriodData] = useState<Record<string, PeriodData[]>>({});
    const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
    const [selectedRowForPeriod, setSelectedRowForPeriod] = useState<{ id: string; name: string } | null>(null);

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
        try {
            const response = await fetch(`/api/data-tables?client_id=${clientId}`);
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
            setLoading(false);
        }
    };

    const fetchTableData = async (tableId: string) => {
        try {
            const response = await fetch(`/api/data-tables/${tableId}`);
            const data = await response.json();

            setTables((prev) =>
                prev.map((t) =>
                    t.id === tableId
                        ? { ...t, columns: data.table.columns, rows: data.table.rows }
                        : t
                )
            );
        } catch (error) {
            console.error('Error fetching table data:', error);
        }
    };

    const handleTabChange = (tableId: string) => {
        setActiveTableId(tableId);
        fetchTableData(tableId);
    };

    const handleAddRow = async () => {
        if (!activeTableId) return;

        try {
            const response = await fetch(`/api/data-tables/${activeTableId}/rows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: {} }),
            });

            if (response.ok) {
                fetchTableData(activeTableId);
            }
        } catch (error) {
            console.error('Error adding row:', error);
        }
    };

    const handleUpdateRow = async (rowId: string, data: Record<string, any>) => {
        if (!activeTableId) return;

        try {
            await fetch(`/api/data-tables/${activeTableId}/rows/${rowId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            });

            // Optimistic update
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
        } catch (error) {
            console.error('Error updating row:', error);
        }
    };

    const handleDeleteRow = async (rowId: string) => {
        if (!activeTableId) return;

        try {
            await fetch(`/api/data-tables/${activeTableId}/rows/${rowId}`, {
                method: 'DELETE',
            });

            setTables((prev) =>
                prev.map((t) =>
                    t.id === activeTableId
                        ? { ...t, rows: t.rows.filter((r) => r.id !== rowId) }
                        : t
                )
            );
        } catch (error) {
            console.error('Error deleting row:', error);
        }
    };

    const handleAddColumn = async (name: string, type: ColumnType) => {
        if (!activeTableId) return;

        try {
            await fetch(`/api/data-tables/${activeTableId}/columns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type }),
            });

            fetchTableData(activeTableId);
        } catch (error) {
            console.error('Error adding column:', error);
        }
    };

    const handleUpdateColumn = async (columnId: string, updates: Partial<DataColumn>) => {
        if (!activeTableId) return;

        try {
            await fetch(`/api/data-tables/${activeTableId}/columns/${columnId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            fetchTableData(activeTableId);
        } catch (error) {
            console.error('Error updating column:', error);
        }
    };

    const handleDeleteColumn = async (columnId: string) => {
        if (!activeTableId) return;

        try {
            await fetch(`/api/data-tables/${activeTableId}/columns/${columnId}`, {
                method: 'DELETE',
            });

            fetchTableData(activeTableId);
        } catch (error) {
            console.error('Error deleting column:', error);
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

        const newPeriodData: Record<string, PeriodData[]> = {};

        await Promise.all(
            rows.map(async (row) => {
                try {
                    const response = await fetch(`/api/data-tables/${tableId}/rows/${row.id}/periods`);
                    const data = await response.json();
                    newPeriodData[row.id] = data;
                } catch (error) {
                    console.error(`Error fetching periods for row ${row.id}:`, error);
                    newPeriodData[row.id] = [];
                }
            })
        );

        setPeriodData(newPeriodData);
    };

    // Handle opening period dialog
    const handleOpenPeriodDialog = (rowId: string, rowName: string) => {
        setSelectedRowForPeriod({ id: rowId, name: rowName });
        setPeriodDialogOpen(true);
    };

    // Handle updating period data
    const handleUpdatePeriod = async (periodId: string, metrics: Record<string, number>) => {
        if (!activeTableId || !selectedRowForPeriod) return;

        try {
            const response = await fetch(
                `/api/data-tables/${activeTableId}/rows/${selectedRowForPeriod.id}/periods/${periodId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ metrics }),
                }
            );

            if (response.ok) {
                const updatedPeriod = await response.json();

                // Update local state
                setPeriodData(prev => ({
                    ...prev,
                    [selectedRowForPeriod.id]: prev[selectedRowForPeriod.id]?.map(p =>
                        p.id === periodId ? updatedPeriod : p
                    ) || [],
                }));
            }
        } catch (error) {
            console.error('Error updating period:', error);
        }
    };

    const activeTable = tables.find((t) => t.id === activeTableId);

    // Fetch period data when active table changes and has time tracking
    useEffect(() => {
        if (activeTable?.time_tracking?.enabled && activeTable.rows?.length) {
            fetchPeriodData(activeTable.id, activeTable.rows);
        }
    }, [activeTableId, activeTable?.rows?.length]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-10 bg-muted/30 animate-pulse rounded" />
                <div className="h-64 bg-muted/30 animate-pulse rounded" />
            </div>
        );
    }

    // Empty state
    if (tables.length === 0) {
        return (
            <div className="border border-dashed border-border/60 rounded-lg">
                <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="rounded-full bg-muted/60 p-5 mb-4">
                        <Database className="h-10 w-10 text-muted-foreground/60" />
                    </div>

                    <h3 className="text-base font-semibold mb-1.5 text-foreground">
                        No data tables yet
                    </h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                        Create your first data table to start tracking information.
                        Choose from templates or create a blank table.
                    </p>

                    <Button onClick={() => setCreateDialogOpen(true)} data-onboarding="add-table-btn">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Data Table
                    </Button>
                </div>

                <CreateTableDialog
                    open={createDialogOpen}
                    onOpenChange={setCreateDialogOpen}
                    clientId={clientId}
                    onTableCreated={fetchTables}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Tabs Header */}
            <div className="flex items-center gap-2 border-b">
                <div className="flex-1 flex items-center gap-1 overflow-x-auto pb-px">
                    {tables.map((table) => (
                        <div
                            key={table.id}
                            className={`group flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                                activeTableId === table.id
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                            }`}
                            onClick={() => handleTabChange(table.id)}
                        >
                            {iconMap[table.icon] || <Table className="h-4 w-4" />}
                            <span>{table.name}</span>
                            <span className="text-xs text-muted-foreground ml-1">
                                {table.row_count || table.rows?.length || 0}
                            </span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-muted rounded flex items-center justify-center"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreHorizontal className="h-3 w-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenRenameDialog(table);
                                        }}
                                    >
                                        <Edit className="h-3.5 w-3.5 mr-2" />
                                        Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenTimeTrackingConfig(table);
                                        }}
                                    >
                                        <BarChart3 className="h-3.5 w-3.5 mr-2" />
                                        Progress Tracking
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => handleDeleteTable(table.id)}
                                        className="text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                    {/* Add Table Button - inline with tabs */}
                    <button
                        className="flex items-center justify-center h-8 w-8 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setCreateDialogOpen(true)}
                        title="Add Table"
                        data-onboarding="add-table-btn"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
                {activeTable && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setImportDialogOpen(true)}
                    >
                        <Upload className="h-4 w-4 mr-1" />
                        Import CSV
                    </Button>
                )}
                {activeTable?.time_tracking?.enabled && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setDownloadDialogOpen(true)}
                    >
                        <Download className="h-4 w-4 mr-1" />
                        Download Report
                    </Button>
                )}
            </div>

            {/* Active Table Content */}
            {activeTable && (
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
                    onOpenPeriodDialog={handleOpenPeriodDialog}
                    onConfigureTimeTracking={() => handleOpenTimeTrackingConfig(activeTable)}
                />
            )}

            <CreateTableDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                clientId={clientId}
                onTableCreated={fetchTables}
            />

            {/* Period Data Dialog */}
            {selectedRowForPeriod && activeTable?.time_tracking && (
                <PeriodDataDialog
                    open={periodDialogOpen}
                    onOpenChange={setPeriodDialogOpen}
                    rowId={selectedRowForPeriod.id}
                    rowName={selectedRowForPeriod.name}
                    timeTracking={activeTable.time_tracking}
                    periods={periodData[selectedRowForPeriod.id] || []}
                    onUpdatePeriod={handleUpdatePeriod}
                />
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
                        fetchTableData(activeTable.id);
                    }}
                />
            )}

            {/* Rename Table Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Rename Table</DialogTitle>
                        <DialogDescription>
                            Enter a new name for this table.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={newTableName}
                            onChange={(e) => setNewTableName(e.target.value)}
                            placeholder="Table name"
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
