'use client';

import { useState, useRef, useEffect } from 'react';
import { CustomColumn, CustomColumnType } from '@/lib/db/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, Type, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CustomColumnHeaderProps {
    column: CustomColumn;
    onUpdate: (updates: Partial<CustomColumn>) => void;
    onDelete: () => void;
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

const columnTypeIcons: Record<CustomColumnType, string> = {
    text: 'T',
    number: '#',
    percentage: '%',
    select: '⊙',
    date: '📅',
    checkbox: '☑',
    email: '@',
    phone: '📞',
    url: '🔗',
};

export function CustomColumnHeader({ column, onUpdate, onDelete }: CustomColumnHeaderProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(column.name);
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingName && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditingName]);

    const handleNameSave = () => {
        if (editName.trim() && editName !== column.name) {
            onUpdate({ name: editName.trim() });
        } else {
            setEditName(column.name);
        }
        setIsEditingName(false);
    };

    const handleTypeChange = (type: CustomColumnType) => {
        onUpdate({ type });
    };

    if (isEditingName) {
        return (
            <div className="flex items-center gap-1 min-w-[120px]">
                <Input
                    ref={inputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameSave();
                        if (e.key === 'Escape') {
                            setEditName(column.name);
                            setIsEditingName(false);
                        }
                    }}
                    className="h-7 text-sm font-medium"
                />
            </div>
        );
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 hover:bg-muted/50 px-2 py-1 rounded -mx-2 -my-1 transition-colors group">
                    <span className="text-xs opacity-60">{columnTypeIcons[column.type]}</span>
                    <span className="font-medium">{column.name}</span>
                    <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Column Options</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={() => {
                        setIsEditingName(true);
                        setIsOpen(false);
                    }}
                >
                    Rename
                </DropdownMenuItem>

                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Type className="h-4 w-4 mr-2" />
                        Change Type
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        {Object.entries(columnTypeLabels).map(([type, label]) => (
                            <DropdownMenuItem
                                key={type}
                                onClick={() => handleTypeChange(type as CustomColumnType)}
                            >
                                <span className="text-xs mr-2 opacity-60 w-4">
                                    {columnTypeIcons[type as CustomColumnType]}
                                </span>
                                {label}
                                {column.type === type && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

                {column.type === 'select' && (
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.preventDefault();
                            // Keep dropdown open for options editing
                        }}
                        className="flex-col items-start"
                    >
                        <Label className="text-xs mb-1">Select Options</Label>
                        <Input
                            value={column.options?.join(', ') || ''}
                            onChange={(e) => {
                                onUpdate({
                                    options: e.target.value
                                        .split(',')
                                        .map(o => o.trim())
                                        .filter(Boolean),
                                });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Option 1, Option 2"
                            className="h-7 text-xs"
                        />
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Column
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
