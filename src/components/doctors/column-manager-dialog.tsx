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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CustomColumn, CustomColumnType } from '@/lib/db/types';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface ColumnManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    columns: CustomColumn[];
    onSave: (columns: CustomColumn[]) => void;
}

const columnTypeLabels: Record<CustomColumnType, string> = {
    text: 'Text',
    number: 'Number',
    percentage: 'Percentage',
    select: 'Select',
    date: 'Date',
    checkbox: 'Checkbox',
    email: 'Email',
    phone: 'Phone',
    url: 'URL',
};

export function ColumnManagerDialog({
    open,
    onOpenChange,
    columns,
    onSave,
}: ColumnManagerDialogProps) {
    const [editingColumns, setEditingColumns] = useState<CustomColumn[]>(columns);

    // Sync editingColumns when dialog opens or columns change
    useEffect(() => {
        if (open) {
            setEditingColumns(columns);
        }
    }, [open, columns]);

    const handleAddColumn = () => {
        const newColumn: CustomColumn = {
            id: `custom_${Date.now()}`,
            name: 'New Column',
            type: 'text',
            order_index: editingColumns.length,
        };
        setEditingColumns([...editingColumns, newColumn]);
    };

    const handleRemoveColumn = (columnId: string) => {
        setEditingColumns(editingColumns.filter(c => c.id !== columnId));
    };

    const handleUpdateColumn = (columnId: string, updates: Partial<CustomColumn>) => {
        setEditingColumns(
            editingColumns.map(col =>
                col.id === columnId ? { ...col, ...updates } : col
            )
        );
    };

    const handleSave = () => {
        // Validate column names
        const names = editingColumns.map(c => c.name.trim());
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

        if (duplicates.length > 0) {
            toast.error('Column names must be unique');
            return;
        }

        if (names.some(name => !name)) {
            toast.error('All columns must have a name');
            return;
        }

        onSave(editingColumns);
        onOpenChange(false);
        toast.success('Columns updated successfully');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Columns</DialogTitle>
                    <DialogDescription>
                        Add, remove, or configure custom columns for your doctor tracking table
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 p-4 pt-4">
                    {editingColumns.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            No custom columns yet. Click "Add Column" to create one.
                        </div>
                    ) : (
                        editingColumns.map((column, index) => (
                            <div
                                key={column.id}
                                className="p-3 border rounded-lg bg-muted/50 space-y-2"
                            >
                                <div className="flex items-start gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move mt-6" />

                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Column Name</Label>
                                            <Input
                                                value={column.name}
                                                onChange={(e) =>
                                                    handleUpdateColumn(column.id, { name: e.target.value })
                                                }
                                                placeholder="Column name"
                                                className="h-8"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs">Type</Label>
                                            <Select
                                                value={column.type}
                                                onValueChange={(value: CustomColumnType) =>
                                                    handleUpdateColumn(column.id, { type: value })
                                                }
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(columnTypeLabels).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveColumn(column.id)}
                                        className="h-8 w-8 p-0 mt-6"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>

                                {column.type === 'select' && (
                                    <div className="space-y-1 ml-6">
                                        <Label className="text-xs">Options (comma-separated)</Label>
                                        <Input
                                            value={column.options?.join(', ') || ''}
                                            onChange={(e) =>
                                                handleUpdateColumn(column.id, {
                                                    options: e.target.value
                                                        .split(',')
                                                        .map(o => o.trim())
                                                        .filter(Boolean),
                                                })
                                            }
                                            placeholder="Option 1, Option 2, Option 3"
                                            className="h-8"
                                        />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddColumn}
                    className="w-full"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Column
                </Button>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
