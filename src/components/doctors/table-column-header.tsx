'use client';

import { useState, useRef, useEffect } from 'react';
import { CustomColumnType } from '@/lib/db/types';
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
import { ChevronDown, Type, Trash2, Check, EyeOff } from 'lucide-react';

interface TableColumnHeaderProps {
    name: string;
    type?: CustomColumnType;
    icon?: string;
    isCustom?: boolean;
    canDelete?: boolean;
    canRename?: boolean;
    canChangeType?: boolean;
    canHide?: boolean;
    options?: string[];
    onUpdate?: (updates: { name?: string; type?: CustomColumnType; options?: string[] }) => void;
    onDelete?: () => void;
    onHide?: () => void;
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

export function TableColumnHeader({
    name,
    type = 'text',
    icon,
    isCustom = false,
    canDelete = false,
    canRename = false,
    canChangeType = false,
    canHide = false,
    options,
    onUpdate,
    onDelete,
    onHide,
}: TableColumnHeaderProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(name);
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingName && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditingName]);

    const handleNameSave = () => {
        if (editName.trim() && editName !== name && onUpdate) {
            onUpdate({ name: editName.trim() });
        } else {
            setEditName(name);
        }
        setIsEditingName(false);
    };

    const handleTypeChange = (newType: CustomColumnType) => {
        if (onUpdate) {
            onUpdate({ type: newType });
        }
    };

    // If editing name inline
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
                            setEditName(name);
                            setIsEditingName(false);
                        }
                    }}
                    className="h-7 text-sm font-medium border-none bg-transparent focus-visible:ring-1"
                />
            </div>
        );
    }

    // If no interactive features, just show the name
    if (!canRename && !canChangeType && !canDelete && !canHide) {
        return (
            <div className="flex items-center gap-1.5">
                {icon && <span className="text-xs opacity-60">{icon}</span>}
                {!icon && type && <span className="text-xs opacity-60">{columnTypeIcons[type]}</span>}
                <span className="font-medium text-sm">{name}</span>
            </div>
        );
    }

    // Interactive header with dropdown
    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 hover:bg-accent/50 px-2 py-1.5 rounded -mx-2 -my-1.5 transition-colors group w-full text-left">
                    {icon && <span className="text-xs opacity-60">{icon}</span>}
                    {!icon && type && <span className="text-xs opacity-60">{columnTypeIcons[type]}</span>}
                    <span className="font-medium text-sm">{name}</span>
                    <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity ml-auto" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Column Options
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {canRename && (
                    <DropdownMenuItem
                        onClick={() => {
                            setIsEditingName(true);
                            setIsOpen(false);
                        }}
                    >
                        Rename
                    </DropdownMenuItem>
                )}

                {canChangeType && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <Type className="h-4 w-4 mr-2" />
                            Change Type
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {Object.entries(columnTypeLabels).map(([typeKey, label]) => (
                                <DropdownMenuItem
                                    key={typeKey}
                                    onClick={() => handleTypeChange(typeKey as CustomColumnType)}
                                >
                                    <span className="text-xs mr-2 opacity-60 w-4">
                                        {columnTypeIcons[typeKey as CustomColumnType]}
                                    </span>
                                    {label}
                                    {type === typeKey && <Check className="h-3 w-3 ml-auto" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}

                {type === 'select' && canChangeType && (
                    <DropdownMenuItem
                        onClick={(e) => e.preventDefault()}
                        className="flex-col items-start"
                    >
                        <Label className="text-xs mb-1">Select Options</Label>
                        <Input
                            value={options?.join(', ') || ''}
                            onChange={(e) => {
                                onUpdate?.({
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

                {canHide && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onHide}>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Hide Column
                        </DropdownMenuItem>
                    </>
                )}

                {canDelete && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={onDelete}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Column
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
