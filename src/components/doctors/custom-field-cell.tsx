'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Check, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomColumn } from '@/lib/db/types';

interface CustomFieldCellProps {
    column: CustomColumn;
    value: any;
    onSave: (value: any) => Promise<void>;
}

export function CustomFieldCell({ column, value, onSave }: CustomFieldCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value ?? '');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(value ?? '');
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        let finalValue = editValue;

        // Convert value based on type
        if (column.type === 'number' || column.type === 'percentage') {
            finalValue = editValue === '' ? null : Number(editValue);
        } else if (column.type === 'checkbox') {
            finalValue = Boolean(editValue);
        }

        if (finalValue === value) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            await onSave(finalValue);
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving:', error);
            setEditValue(value ?? '');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditValue(value ?? '');
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    // Checkbox type - always editable without entering edit mode
    if (column.type === 'checkbox') {
        return (
            <Checkbox
                checked={Boolean(value)}
                onCheckedChange={async (checked) => {
                    setIsSaving(true);
                    try {
                        await onSave(checked);
                    } finally {
                        setIsSaving(false);
                    }
                }}
                disabled={isSaving}
            />
        );
    }

    // Select type
    if (column.type === 'select') {
        if (!isEditing) {
            return (
                <div
                    className="group flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1"
                    onClick={() => setIsEditing(true)}
                >
                    <span className="flex-1">{value || 'Select...'}</span>
                    <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                </div>
            );
        }

        return (
            <div className="flex items-center gap-1">
                <Select
                    value={editValue || ''}
                    onValueChange={(val) => {
                        setEditValue(val);
                        // Auto-save for select
                        onSave(val).then(() => setIsEditing(false));
                    }}
                >
                    <SelectTrigger className="h-7 text-sm">
                        <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                        {column.options?.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={handleCancel}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <X className="h-3 w-3 text-red-600" />
                </Button>
            </div>
        );
    }

    // Display value based on type
    const getDisplayValue = () => {
        if (value === null || value === undefined || value === '') {
            return 'Click to edit';
        }

        if (column.type === 'percentage') {
            return `${value}%`;
        }

        if (column.type === 'date') {
            return new Date(value).toLocaleDateString();
        }

        return String(value);
    };

    // Edit mode for text, number, percentage, date, email, phone, url
    if (!isEditing) {
        return (
            <div
                className="group flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1"
                onClick={() => setIsEditing(true)}
            >
                <span className="flex-1">{getDisplayValue()}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </div>
        );
    }

    // Determine input type
    const getInputType = () => {
        switch (column.type) {
            case 'number':
            case 'percentage':
                return 'number';
            case 'date':
                return 'date';
            case 'email':
                return 'email';
            case 'phone':
                return 'tel';
            case 'url':
                return 'url';
            default:
                return 'text';
        }
    };

    return (
        <div className="flex items-center gap-1">
            <Input
                ref={inputRef}
                type={getInputType()}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                disabled={isSaving}
                className="h-7 text-sm"
            />
            <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={handleSave}
                disabled={isSaving}
            >
                <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={handleCancel}
                disabled={isSaving}
                onMouseDown={(e) => e.preventDefault()}
            >
                <X className="h-3 w-3 text-red-600" />
            </Button>
        </div>
    );
}
