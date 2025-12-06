'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, BarChart3, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { OverviewWidget, AggregationType, ChartType, DataColumn } from '@/lib/db/types';

interface TableWithColumns {
    table_id: string;
    table_name: string;
    table_icon: string;
    table_color: string;
    columns: {
        id: string;
        name: string;
        type: string;
        config?: any;
    }[];
}

interface OverviewConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    widgets: OverviewWidget[];
    onWidgetsChange: () => void;
}

const AGGREGATION_OPTIONS: { value: AggregationType; label: string }[] = [
    { value: 'sum', label: 'Sum' },
    { value: 'average', label: 'Average' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
    { value: 'count', label: 'Count' },
];

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
    { value: 'bar', label: 'Bar Chart' },
    { value: 'pie', label: 'Pie Chart' },
    { value: 'donut', label: 'Donut Chart' },
];

export function OverviewConfigDialog({
    open,
    onOpenChange,
    clientId,
    widgets,
    onWidgetsChange,
}: OverviewConfigDialogProps) {
    const [availableTables, setAvailableTables] = useState<TableWithColumns[]>([]);
    const [chartableTables, setChartableTables] = useState<TableWithColumns[]>([]);
    const [loading, setLoading] = useState(false);
    const [addMode, setAddMode] = useState<'metric' | 'chart' | null>(null);

    // Form state for adding new widget
    const [newLabel, setNewLabel] = useState('');
    const [selectedTableId, setSelectedTableId] = useState('');
    const [selectedColumnId, setSelectedColumnId] = useState('');
    const [selectedAggregation, setSelectedAggregation] = useState<AggregationType>('sum');
    const [selectedChartType, setSelectedChartType] = useState<ChartType>('bar');

    useEffect(() => {
        if (open) {
            fetchColumns();
        }
    }, [open, clientId]);

    const fetchColumns = async () => {
        setLoading(true);
        try {
            // Fetch aggregatable columns
            const aggResponse = await fetch(`/api/overview-widgets/columns?client_id=${clientId}&type=aggregatable`);
            const aggData = await aggResponse.json();
            setAvailableTables(aggData.tables || []);

            // Fetch chartable columns
            const chartResponse = await fetch(`/api/overview-widgets/columns?client_id=${clientId}&type=chartable`);
            const chartData = await chartResponse.json();
            setChartableTables(chartData.tables || []);
        } catch (error) {
            console.error('Error fetching columns:', error);
            toast.error('Failed to load column options');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setAddMode(null);
        setNewLabel('');
        setSelectedTableId('');
        setSelectedColumnId('');
        setSelectedAggregation('sum');
        setSelectedChartType('bar');
    };

    const handleAddWidget = async () => {
        if (!newLabel || !selectedTableId || !selectedColumnId) {
            toast.error('Please fill in all fields');
            return;
        }

        try {
            const config = addMode === 'metric'
                ? {
                    table_id: selectedTableId,
                    column_id: selectedColumnId,
                    aggregation: selectedAggregation,
                }
                : {
                    table_id: selectedTableId,
                    column_id: selectedColumnId,
                    chart_type: selectedChartType,
                };

            const response = await fetch('/api/overview-widgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    type: addMode === 'metric' ? 'metric_card' : 'chart',
                    label: newLabel,
                    config,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create widget');
            }

            toast.success('Widget added successfully');
            resetForm();
            onWidgetsChange();
        } catch (error) {
            console.error('Error creating widget:', error);
            toast.error('Failed to create widget');
        }
    };

    const handleDeleteWidget = async (widgetId: string) => {
        try {
            const response = await fetch(`/api/overview-widgets/${widgetId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete widget');
            }

            toast.success('Widget removed');
            onWidgetsChange();
        } catch (error) {
            console.error('Error deleting widget:', error);
            toast.error('Failed to remove widget');
        }
    };

    const getColumnName = (widget: OverviewWidget) => {
        const tables = widget.type === 'metric_card' ? availableTables : chartableTables;
        const table = tables.find(t => t.table_id === widget.config.table_id);
        const column = table?.columns.find(c => c.id === widget.config.column_id);
        return column?.name || 'Unknown column';
    };

    const getTableName = (widget: OverviewWidget) => {
        const tables = widget.type === 'metric_card' ? availableTables : chartableTables;
        const table = tables.find(t => t.table_id === widget.config.table_id);
        return table?.table_name || 'Unknown table';
    };

    const selectedTable = addMode === 'metric'
        ? availableTables.find(t => t.table_id === selectedTableId)
        : chartableTables.find(t => t.table_id === selectedTableId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Configure Overview Widgets</DialogTitle>
                    <DialogDescription>
                        Add metric cards and charts to display data from your tables on the overview page.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 p-4 pt-4">
                    {/* Existing Widgets */}
                    {widgets.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold">Current Widgets</h4>
                            <div className="space-y-2">
                                {widgets.map((widget) => (
                                    <div
                                        key={widget.id}
                                        className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                                    >
                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {widget.type === 'metric_card' ? (
                                                    <Hash className="h-4 w-4 text-blue-500" />
                                                ) : (
                                                    <BarChart3 className="h-4 w-4 text-purple-500" />
                                                )}
                                                <span className="font-medium truncate">
                                                    {widget.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {getTableName(widget)} → {getColumnName(widget)}
                                                {widget.type === 'metric_card' && (
                                                    <Badge variant="outline" className="ml-2 text-xs">
                                                        {(widget.config as any).aggregation}
                                                    </Badge>
                                                )}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteWidget(widget.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Widget Section */}
                    {addMode === null ? (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold">Add Widget</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <Card
                                    className="cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => setAddMode('metric')}
                                >
                                    <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                                            <Hash className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div className="font-medium">Metric Card</div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Sum, average, min, max of a number column
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card
                                    className="cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => setAddMode('chart')}
                                >
                                    <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                                            <BarChart3 className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div className="font-medium">Chart</div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Visualize status or select column distribution
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">
                                    {addMode === 'metric' ? 'Add Metric Card' : 'Add Chart'}
                                </h4>
                                <Button variant="ghost" size="sm" onClick={resetForm}>
                                    Cancel
                                </Button>
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label>Label</Label>
                                    <Input
                                        placeholder={addMode === 'metric' ? 'e.g., Total Revenue' : 'e.g., Status Breakdown'}
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Table</Label>
                                    <Select
                                        value={selectedTableId}
                                        onValueChange={(value) => {
                                            setSelectedTableId(value);
                                            setSelectedColumnId('');
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a table" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(addMode === 'metric' ? availableTables : chartableTables).map((table) => (
                                                <SelectItem key={table.table_id} value={table.table_id}>
                                                    {table.table_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedTableId && (
                                    <div className="space-y-2">
                                        <Label>Column</Label>
                                        <Select
                                            value={selectedColumnId}
                                            onValueChange={setSelectedColumnId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a column" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedTable?.columns.map((col) => (
                                                    <SelectItem key={col.id} value={col.id}>
                                                        {col.name}
                                                        <span className="text-muted-foreground ml-2">
                                                            ({col.type})
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {addMode === 'metric' && selectedColumnId && (
                                    <div className="space-y-2">
                                        <Label>Aggregation</Label>
                                        <Select
                                            value={selectedAggregation}
                                            onValueChange={(v) => setSelectedAggregation(v as AggregationType)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {AGGREGATION_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {addMode === 'chart' && selectedColumnId && (
                                    <div className="space-y-2">
                                        <Label>Chart Type</Label>
                                        <Select
                                            value={selectedChartType}
                                            onValueChange={(v) => setSelectedChartType(v as ChartType)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CHART_TYPE_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <Button
                                    onClick={handleAddWidget}
                                    disabled={!newLabel || !selectedTableId || !selectedColumnId}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add {addMode === 'metric' ? 'Metric Card' : 'Chart'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {widgets.length === 0 && addMode === null && (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No widgets configured yet.</p>
                            <p className="text-sm">Add metric cards or charts to display your data.</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
