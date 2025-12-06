'use client';

import { useState, useRef, useEffect } from 'react';
import { StatusOption, StatusColor, StatusGroup, StatusConfig } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    GripVertical,
    Plus,
    X,
    Circle,
    CheckCircle2,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Status group definitions (Notion-style)
const STATUS_GROUPS: Record<StatusGroup, { label: string; icon: React.ReactNode; defaultColor: StatusColor }> = {
    todo: {
        label: 'To Do',
        icon: <Circle className="h-4 w-4" />,
        defaultColor: 'gray'
    },
    in_progress: {
        label: 'In Progress',
        icon: <Loader2 className="h-4 w-4" />,
        defaultColor: 'blue'
    },
    complete: {
        label: 'Complete',
        icon: <CheckCircle2 className="h-4 w-4" />,
        defaultColor: 'green'
    },
};

// Notion-style color palette using design system CSS variables
const STATUS_COLORS: { color: StatusColor; bg: string; text: string; dot: string; label: string }[] = [
    { color: 'default', bg: 'bg-[var(--notion-default)]', text: 'text-[var(--notion-default-text)]', dot: 'bg-[var(--notion-default-solid)]', label: 'Default' },
    { color: 'gray', bg: 'bg-[var(--notion-gray)]', text: 'text-[var(--notion-gray-text)]', dot: 'bg-[var(--notion-gray-solid)]', label: 'Gray' },
    { color: 'brown', bg: 'bg-[var(--notion-brown)]', text: 'text-[var(--notion-brown-text)]', dot: 'bg-[var(--notion-brown-solid)]', label: 'Brown' },
    { color: 'orange', bg: 'bg-[var(--notion-orange)]', text: 'text-[var(--notion-orange-text)]', dot: 'bg-[var(--notion-orange-solid)]', label: 'Orange' },
    { color: 'yellow', bg: 'bg-[var(--notion-yellow)]', text: 'text-[var(--notion-yellow-text)]', dot: 'bg-[var(--notion-yellow-solid)]', label: 'Yellow' },
    { color: 'green', bg: 'bg-[var(--notion-green)]', text: 'text-[var(--notion-green-text)]', dot: 'bg-[var(--notion-green-solid)]', label: 'Green' },
    { color: 'blue', bg: 'bg-[var(--notion-blue)]', text: 'text-[var(--notion-blue-text)]', dot: 'bg-[var(--notion-blue-solid)]', label: 'Blue' },
    { color: 'purple', bg: 'bg-[var(--notion-purple)]', text: 'text-[var(--notion-purple-text)]', dot: 'bg-[var(--notion-purple-solid)]', label: 'Purple' },
    { color: 'pink', bg: 'bg-[var(--notion-pink)]', text: 'text-[var(--notion-pink-text)]', dot: 'bg-[var(--notion-pink-solid)]', label: 'Pink' },
    { color: 'red', bg: 'bg-[var(--notion-red)]', text: 'text-[var(--notion-red-text)]', dot: 'bg-[var(--notion-red-solid)]', label: 'Red' },
];

const getColorStyle = (color: StatusColor) => {
    return STATUS_COLORS.find(c => c.color === color) || STATUS_COLORS[0];
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Default status options (Notion-style)
export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
    { id: generateId(), value: 'not_started', label: 'Not Started', color: 'gray', group: 'todo' },
    { id: generateId(), value: 'in_progress', label: 'In Progress', color: 'blue', group: 'in_progress' },
    { id: generateId(), value: 'done', label: 'Done', color: 'green', group: 'complete' },
];

// Color Picker Component
function ColorPicker({
    value,
    onChange
}: {
    value: StatusColor;
    onChange: (color: StatusColor) => void;
}) {
    const [open, setOpen] = useState(false);
    const colorStyle = getColorStyle(value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        'h-5 w-5 rounded-full flex items-center justify-center transition-transform hover:scale-110',
                        colorStyle.dot
                    )}
                />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
                <div className="grid grid-cols-5 gap-1.5">
                    {STATUS_COLORS.map(({ color, dot, label }) => (
                        <button
                            key={color}
                            onClick={() => { onChange(color); setOpen(false); }}
                            title={label}
                            className={cn(
                                'h-6 w-6 rounded-full transition-transform hover:scale-110',
                                dot,
                                value === color && 'ring-2 ring-offset-2 ring-primary'
                            )}
                        />
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// Single Status Option Row
function StatusOptionRow({
    option,
    onUpdate,
    onDelete,
    canDelete,
}: {
    option: StatusOption;
    onUpdate: (updates: Partial<StatusOption>) => void;
    onDelete: () => void;
    canDelete: boolean;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editLabel, setEditLabel] = useState(option.label);
    const inputRef = useRef<HTMLInputElement>(null);
    const colorStyle = getColorStyle(option.color);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editLabel.trim() && editLabel !== option.label) {
            onUpdate({
                label: editLabel.trim(),
                value: editLabel.trim().toLowerCase().replace(/\s+/g, '_')
            });
        } else {
            setEditLabel(option.label);
        }
        setIsEditing(false);
    };

    return (
        <div className="group flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />

            <ColorPicker
                value={option.color}
                onChange={(color) => onUpdate({ color })}
            />

            {isEditing ? (
                <Input
                    ref={inputRef}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') {
                            setEditLabel(option.label);
                            setIsEditing(false);
                        }
                    }}
                    className="h-7 flex-1 text-sm"
                />
            ) : (
                <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 text-left"
                >
                    <span className={cn(
                        'inline-flex px-2 py-0.5 rounded text-xs font-medium',
                        colorStyle.bg,
                        colorStyle.text
                    )}>
                        {option.label}
                    </span>
                </button>
            )}

            {canDelete && (
                <button
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all text-muted-foreground hover:text-destructive"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

// Status Group Section
function StatusGroupSection({
    group,
    options,
    onUpdate,
    onDelete,
    onAdd,
    maxOptions,
}: {
    group: StatusGroup;
    options: StatusOption[];
    onUpdate: (optionId: string, updates: Partial<StatusOption>) => void;
    onDelete: (optionId: string) => void;
    onAdd: () => void;
    maxOptions: number;
}) {
    const groupConfig = STATUS_GROUPS[group];
    const canAddMore = options.length < maxOptions;
    const totalOptions = options.length;

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-muted-foreground">{groupConfig.icon}</span>
                <span className="text-sm font-medium text-muted-foreground">{groupConfig.label}</span>
                <span className="text-xs text-muted-foreground/60">({totalOptions})</span>
            </div>

            <div className="space-y-0.5">
                {options.map((option) => (
                    <StatusOptionRow
                        key={option.id}
                        option={option}
                        onUpdate={(updates) => onUpdate(option.id, updates)}
                        onDelete={() => onDelete(option.id)}
                        canDelete={totalOptions > 1}
                    />
                ))}
            </div>

            {canAddMore && (
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add status</span>
                </button>
            )}
        </div>
    );
}

interface StatusConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: StatusConfig | undefined;
    onSave: (config: StatusConfig) => void;
    columnName: string;
}

export function StatusConfigDialog({
    open,
    onOpenChange,
    config,
    onSave,
    columnName,
}: StatusConfigDialogProps) {
    // Initialize with existing config or defaults
    const [options, setOptions] = useState<StatusOption[]>(() => {
        if (config?.options && config.options.length > 0) {
            return config.options;
        }
        return DEFAULT_STATUS_OPTIONS.map(opt => ({ ...opt, id: generateId() }));
    });

    // Reset when dialog opens with new config
    useEffect(() => {
        if (open) {
            if (config?.options && config.options.length > 0) {
                setOptions(config.options);
            } else {
                setOptions(DEFAULT_STATUS_OPTIONS.map(opt => ({ ...opt, id: generateId() })));
            }
        }
    }, [open, config]);

    const handleUpdate = (optionId: string, updates: Partial<StatusOption>) => {
        setOptions(prev => prev.map(opt =>
            opt.id === optionId ? { ...opt, ...updates } : opt
        ));
    };

    const handleDelete = (optionId: string) => {
        setOptions(prev => prev.filter(opt => opt.id !== optionId));
    };

    const handleAdd = (group: StatusGroup) => {
        const groupConfig = STATUS_GROUPS[group];
        const groupOptions = options.filter(o => o.group === group);
        const newOption: StatusOption = {
            id: generateId(),
            value: `status_${Date.now()}`,
            label: `New ${groupConfig.label}`,
            color: groupConfig.defaultColor,
            group,
        };
        setOptions(prev => [...prev, newOption]);
    };

    const handleSave = () => {
        onSave({ options, showAsCheckbox: config?.showAsCheckbox });
        onOpenChange(false);
    };

    // Group options by status group
    const groupedOptions: Record<StatusGroup, StatusOption[]> = {
        todo: options.filter(o => o.group === 'todo'),
        in_progress: options.filter(o => o.group === 'in_progress'),
        complete: options.filter(o => o.group === 'complete'),
    };

    // Max 5 options per group
    const MAX_OPTIONS_PER_GROUP = 5;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Circle className="h-4 w-4 text-muted-foreground" />
                        Edit Status Options
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Configure status options for &quot;{columnName}&quot;
                    </p>
                </DialogHeader>

                <div className="space-y-4 p-4 pt-4">
                    {(['todo', 'in_progress', 'complete'] as StatusGroup[]).map((group) => (
                        <StatusGroupSection
                            key={group}
                            group={group}
                            options={groupedOptions[group]}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onAdd={() => handleAdd(group)}
                            maxOptions={MAX_OPTIONS_PER_GROUP}
                        />
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
