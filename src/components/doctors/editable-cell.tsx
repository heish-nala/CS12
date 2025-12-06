'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Check, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EditableCellProps {
    value: string;
    onSave: (value: string) => Promise<void>;
    type?: 'text' | 'email' | 'tel' | 'date' | 'number';
    placeholder?: string;
}

export function EditableCell({ value, onSave, type = 'text', placeholder }: EditableCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (editValue === value) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            await onSave(editValue);
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving:', error);
            setEditValue(value); // Reset on error
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    if (!isEditing) {
        return (
            <div
                className="group flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1"
                onClick={() => setIsEditing(true)}
            >
                <span className="flex-1">{value || placeholder || 'Click to edit'}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1">
            <Input
                ref={inputRef}
                type={type}
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
                onMouseDown={(e) => e.preventDefault()} // Prevent blur
            >
                <X className="h-3 w-3 text-red-600" />
            </Button>
        </div>
    );
}
