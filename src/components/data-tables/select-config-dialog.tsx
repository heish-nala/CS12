'use client';

import { useState, useRef, useEffect } from 'react';
import { SelectOption, SelectConfig, StatusColor } from '@/lib/db/types';
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
    List,
    ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Notion-style color palette using design system CSS variables
const SELECT_COLORS: { color: StatusColor; bg: string; text: string; dot: string; label: string }[] = [
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
    return SELECT_COLORS.find(c => c.color === color) || SELECT_COLORS[0];
};

// Auto-assign colors in rotation
const getNextColor = (existingOptions: SelectOption[]): StatusColor => {
    const usedColors = existingOptions.map(o => o.color);
    const availableColor = SELECT_COLORS.find(c => !usedColors.includes(c.color));
    return availableColor?.color || SELECT_COLORS[Math.floor(Math.random() * SELECT_COLORS.length)].color;
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

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
                    {SELECT_COLORS.map(({ color, dot, label }) => (
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

// Single Select Option Row
function SelectOptionRow({
    option,
    onUpdate,
    onDelete,
    canDelete,
}: {
    option: SelectOption;
    onUpdate: (updates: Partial<SelectOption>) => void;
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

interface SelectConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: SelectConfig | undefined;
    onSave: (config: SelectConfig) => void;
    columnName: string;
    isMultiSelect?: boolean;
}

export function SelectConfigDialog({
    open,
    onOpenChange,
    config,
    onSave,
    columnName,
    isMultiSelect = false,
}: SelectConfigDialogProps) {
    // Initialize with existing config or empty
    const [options, setOptions] = useState<SelectOption[]>(() => {
        if (config?.options && config.options.length > 0) {
            return config.options;
        }
        return [];
    });

    const [newOptionLabel, setNewOptionLabel] = useState('');
    const newOptionInputRef = useRef<HTMLInputElement>(null);

    // Reset when dialog opens with new config
    useEffect(() => {
        if (open) {
            if (config?.options && config.options.length > 0) {
                setOptions(config.options);
            } else {
                setOptions([]);
            }
            setNewOptionLabel('');
        }
    }, [open, config]);

    const handleUpdate = (optionId: string, updates: Partial<SelectOption>) => {
        setOptions(prev => prev.map(opt =>
            opt.id === optionId ? { ...opt, ...updates } : opt
        ));
    };

    const handleDelete = (optionId: string) => {
        setOptions(prev => prev.filter(opt => opt.id !== optionId));
    };

    const handleAddOption = () => {
        if (!newOptionLabel.trim()) return;

        const newOption: SelectOption = {
            id: generateId(),
            value: newOptionLabel.trim().toLowerCase().replace(/\s+/g, '_'),
            label: newOptionLabel.trim(),
            color: getNextColor(options),
        };
        setOptions(prev => [...prev, newOption]);
        setNewOptionLabel('');
        newOptionInputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddOption();
        }
    };

    const handleSave = () => {
        onSave({ options, maxSelections: config?.maxSelections });
        onOpenChange(false);
    };

    const Icon = isMultiSelect ? ListChecks : List;
    const title = isMultiSelect ? 'Edit Multi-Select Options' : 'Edit Dropdown Options';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {title}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Configure options for &quot;{columnName}&quot;
                    </p>
                </DialogHeader>

                <div className="space-y-3 p-4 pt-4">
                    {/* Options list */}
                    <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                        {options.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                                No options yet. Add your first option below.
                            </div>
                        ) : (
                            options.map((option) => (
                                <SelectOptionRow
                                    key={option.id}
                                    option={option}
                                    onUpdate={(updates) => handleUpdate(option.id, updates)}
                                    onDelete={() => handleDelete(option.id)}
                                    canDelete={true}
                                />
                            ))
                        )}
                    </div>

                    {/* Add new option */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={newOptionInputRef}
                            value={newOptionLabel}
                            onChange={(e) => setNewOptionLabel(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type and press Enter to add..."
                            className="h-8 flex-1 text-sm"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleAddOption}
                            disabled={!newOptionLabel.trim()}
                        >
                            Add
                        </Button>
                    </div>
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
