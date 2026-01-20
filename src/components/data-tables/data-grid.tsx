'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DataColumn, DataRow, ColumnType, StatusOption, TimeTrackingConfig, PeriodData, ColumnConfig, StatusColor, SelectOption } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Plus,
    Trash2,
    Check,
    Pencil,
    Type,
    Hash,
    Mail,
    Phone,
    Link,
    Calendar,
    CheckSquare,
    List,
    ListChecks,
    CircleDot,
    User,
    DollarSign,
    Percent,
    Star,
    ChevronLeft,
    ArrowUpDown,
    Copy,
    ExternalLink,
    Archive,
    X,
    BarChart3,
    Settings,
    Loader2,
} from 'lucide-react';
import { ColumnConfigDialog } from './column-config-dialog';
import { cn } from '@/lib/utils';

// Column type configurations
const COLUMN_TYPES: Record<ColumnType, { label: string; icon: React.ReactNode }> = {
    text: { label: 'Text', icon: <Type className="h-4 w-4" /> },
    number: { label: 'Numbers', icon: <Hash className="h-4 w-4" /> },
    status: { label: 'Status', icon: <CircleDot className="h-4 w-4" /> },
    date: { label: 'Date', icon: <Calendar className="h-4 w-4" /> },
    person: { label: 'People', icon: <User className="h-4 w-4" /> },
    checkbox: { label: 'Checkbox', icon: <CheckSquare className="h-4 w-4" /> },
    email: { label: 'Email', icon: <Mail className="h-4 w-4" /> },
    phone: { label: 'Phone', icon: <Phone className="h-4 w-4" /> },
    url: { label: 'Link', icon: <Link className="h-4 w-4" /> },
    datetime: { label: 'Date & Time', icon: <Calendar className="h-4 w-4" /> },
    select: { label: 'Dropdown', icon: <List className="h-4 w-4" /> },
    multi_select: { label: 'Tags', icon: <ListChecks className="h-4 w-4" /> },
    currency: { label: 'Currency', icon: <DollarSign className="h-4 w-4" /> },
    percentage: { label: 'Percent', icon: <Percent className="h-4 w-4" /> },
    rating: { label: 'Rating', icon: <Star className="h-4 w-4" /> },
    relationship: { label: 'Connect', icon: <Link className="h-4 w-4" /> },
};

// Notion-style color palette using design system CSS variables
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    default: { bg: 'bg-[var(--notion-default)]', text: 'text-[var(--notion-default-text)]' },
    gray: { bg: 'bg-[var(--notion-gray)]', text: 'text-[var(--notion-gray-text)]' },
    brown: { bg: 'bg-[var(--notion-brown)]', text: 'text-[var(--notion-brown-text)]' },
    orange: { bg: 'bg-[var(--notion-orange)]', text: 'text-[var(--notion-orange-text)]' },
    yellow: { bg: 'bg-[var(--notion-yellow)]', text: 'text-[var(--notion-yellow-text)]' },
    green: { bg: 'bg-[var(--notion-green)]', text: 'text-[var(--notion-green-text)]' },
    blue: { bg: 'bg-[var(--notion-blue)]', text: 'text-[var(--notion-blue-text)]' },
    purple: { bg: 'bg-[var(--notion-purple)]', text: 'text-[var(--notion-purple-text)]' },
    pink: { bg: 'bg-[var(--notion-pink)]', text: 'text-[var(--notion-pink-text)]' },
    red: { bg: 'bg-[var(--notion-red)]', text: 'text-[var(--notion-red-text)]' },
};

// Status group labels
const STATUS_GROUP_LABELS: Record<string, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    complete: 'Complete',
};

// Row height for virtualization
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 41;
const MAX_VISIBLE_ROWS = 15; // Show max 15 rows before scrolling
const OVERSCAN = 5; // Render 5 extra rows above/below viewport

// Column sizing
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 500;
const DEFAULT_COLUMN_WIDTH = 150;

// Phone number formatting helper
function formatPhoneNumber(input: string): string {
    // Extract only digits
    let digits = input.replace(/\D/g, '');

    // Handle different lengths
    if (digits.length === 0) return '';

    // Strip leading 1 for US numbers (11 digits starting with 1)
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }

    // US/Canada format (10 digits): (XXX) XXX-XXXX
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // International or other formats - just group digits
    if (digits.length > 10) {
        return '+' + digits.replace(/(\d{1,3})(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4').trim();
    }

    // Partial numbers - return as-is with some basic formatting
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

interface DataGridProps {
    tableId: string;
    columns: DataColumn[];
    rows: DataRow[];
    onAddRow: () => void;
    onUpdateRow: (rowId: string, data: Record<string, any>) => void;
    onDeleteRow: (rowId: string) => void;
    onAddColumn: (name: string, type: ColumnType) => void;
    onUpdateColumn: (columnId: string, updates: Partial<DataColumn>) => void;
    onDeleteColumn: (columnId: string) => void;
    // Time tracking props
    timeTracking?: TimeTrackingConfig | null;
    periodData?: Record<string, PeriodData[]>; // rowId -> periods
    onOpenPeriodDialog?: (rowId: string, rowName: string) => void;
    onConfigureTimeTracking?: () => void;
    // Loading states for better UX
    isAddingRow?: boolean;
    isAddingColumn?: boolean;
}

// Column type categories for Monday-style picker
const COLUMN_CATEGORIES = {
    essentials: {
        label: 'Essentials',
        types: ['text', 'number', 'status', 'date', 'person'] as ColumnType[],
    },
    data: {
        label: 'Data',
        types: ['email', 'phone', 'url', 'currency', 'percentage'] as ColumnType[],
    },
    advanced: {
        label: 'Advanced',
        types: ['checkbox', 'select', 'multi_select', 'rating', 'datetime'] as ColumnType[],
    },
};

// Add Column Dialog (Monday-style)
function AddColumnDialog({
    onAdd,
    onConfigureTimeTracking,
    hasTimeTracking,
}: {
    onAdd: (name: string, type: ColumnType) => void;
    onConfigureTimeTracking?: () => void;
    hasTimeTracking?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'type' | 'name'>('type');
    const [selectedType, setSelectedType] = useState<ColumnType | null>(null);
    const [name, setName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (step === 'name') setTimeout(() => inputRef.current?.focus(), 50);
        if (step === 'type' && open) setTimeout(() => searchRef.current?.focus(), 50);
    }, [step, open]);

    const handleSelectType = (type: ColumnType) => {
        setSelectedType(type);
        setName(COLUMN_TYPES[type].label);
        setStep('name');
    };

    const handleProgressTracker = () => {
        setOpen(false);
        reset();
        onConfigureTimeTracking?.();
    };

    const handleCreate = () => {
        if (selectedType && name.trim()) {
            onAdd(name.trim(), selectedType);
            setOpen(false);
            reset();
        }
    };

    const reset = () => {
        setStep('type');
        setSelectedType(null);
        setName('');
        setSearchQuery('');
    };

    // Filter column types based on search
    const filteredTypes = searchQuery.trim()
        ? Object.entries(COLUMN_TYPES).filter(([, config]) =>
            config.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : null;

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
                <Plus className="h-4 w-4" />
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50"
                        onClick={() => { setOpen(false); reset(); }}
                    />

                    {/* Dialog */}
                    <div className="relative bg-background rounded-lg shadow-xl border w-[480px] max-h-[70vh] overflow-hidden animate-in fade-in-0 zoom-in-95">
                        {step === 'type' ? (
                            <>
                                {/* Header */}
                                <div className="p-4 border-b">
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-lg font-semibold">Add Column</h2>
                                        <button
                                            onClick={() => { setOpen(false); reset(); }}
                                            className="p-1 rounded hover:bg-muted transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <Input
                                        ref={searchRef}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search column types..."
                                        className="h-9"
                                    />
                                </div>

                                {/* Content */}
                                <div className="p-4 overflow-y-auto max-h-[calc(70vh-120px)]">
                                    {/* Progress Tracker - Featured */}
                                    {!searchQuery && onConfigureTimeTracking && (
                                        <div className="mb-4">
                                            <button
                                                onClick={handleProgressTracker}
                                                className={cn(
                                                    "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left",
                                                    hasTimeTracking
                                                        ? "border-[var(--notion-blue)] bg-[var(--notion-blue)] hover:bg-[var(--notion-blue)]/80"
                                                        : "border-dashed border-muted-foreground/30 hover:border-primary hover:bg-muted/30"
                                                )}
                                            >
                                                <div className={cn(
                                                    "p-2 rounded-lg",
                                                    hasTimeTracking ? "bg-[var(--notion-blue)]" : "bg-muted"
                                                )}>
                                                    <BarChart3 className={cn(
                                                        "h-5 w-5",
                                                        hasTimeTracking ? "text-[var(--notion-blue-text)]" : "text-muted-foreground"
                                                    )} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium flex items-center gap-2">
                                                        Progress Tracker
                                                        {hasTimeTracking && (
                                                            <span className="text-xs bg-[var(--notion-blue)] text-[var(--notion-blue-text)] px-1.5 py-0.5 rounded">
                                                                Active
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Track metrics over time for each row
                                                    </p>
                                                </div>
                                                <Settings className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Search Results */}
                                    {filteredTypes ? (
                                        <div className="space-y-1">
                                            {filteredTypes.length > 0 ? (
                                                filteredTypes.map(([type, config]) => (
                                                    <button
                                                        key={type}
                                                        onClick={() => handleSelectType(type as ColumnType)}
                                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                                                    >
                                                        <span className="text-muted-foreground">{config.icon}</span>
                                                        <span className="font-medium">{config.label}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center py-4">
                                                    No column types found
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        /* Categories */
                                        <div className="space-y-4">
                                            {Object.entries(COLUMN_CATEGORIES).map(([key, category]) => (
                                                <div key={key}>
                                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                                        {category.label}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {category.types.map((type) => (
                                                            <button
                                                                key={type}
                                                                onClick={() => handleSelectType(type)}
                                                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                                                            >
                                                                <span className="text-muted-foreground">
                                                                    {COLUMN_TYPES[type].icon}
                                                                </span>
                                                                <span className="text-sm">{COLUMN_TYPES[type].label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* Name Step */
                            <div className="p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <button
                                        onClick={() => setStep('type')}
                                        className="p-1 rounded hover:bg-muted transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    {selectedType && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">
                                                {COLUMN_TYPES[selectedType].icon}
                                            </span>
                                            <span className="font-medium">
                                                {COLUMN_TYPES[selectedType].label}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block">
                                            Column Name
                                        </label>
                                        <Input
                                            ref={inputRef}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter column name"
                                            className="h-10"
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => { setOpen(false); reset(); }}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleCreate}
                                            disabled={!name.trim()}
                                            className="flex-1"
                                        >
                                            Add Column
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// Check if column type supports configuration
const CONFIGURABLE_TYPES: ColumnType[] = ['status', 'select', 'multi_select'];

// Column Resize Handle Component
function ColumnResizeHandle({
    onResize,
    onResizeEnd,
}: {
    onResize: (delta: number) => void;
    onResizeEnd: () => void;
}) {
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        startXRef.current = e.clientX;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startXRef.current;
            startXRef.current = moveEvent.clientX;
            onResize(delta);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            onResizeEnd();
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            className={cn(
                'absolute right-0 top-0 h-full w-1 cursor-col-resize z-10 group/resize',
                'hover:bg-primary/50 active:bg-primary',
                isResizing && 'bg-primary'
            )}
        >
            <div className={cn(
                'absolute right-0 top-0 h-full w-4 -translate-x-1/2',
            )} />
        </div>
    );
}

// Column Header with sorting
function ColumnHeader({
    column,
    onUpdate,
    onDelete,
    sortDirection,
    onSort,
    onConfigure,
}: {
    column: DataColumn;
    onUpdate: (updates: Partial<DataColumn>) => void;
    onDelete: () => void;
    sortDirection?: 'asc' | 'desc' | null;
    onSort: () => void;
    onConfigure?: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(column.name);
    const inputRef = useRef<HTMLInputElement>(null);

    const isConfigurable = CONFIGURABLE_TYPES.includes(column.type);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editName.trim() && editName !== column.name) {
            onUpdate({ name: editName.trim() });
        } else {
            setEditName(column.name);
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="px-3 py-2">
                <Input
                    ref={inputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') {
                            setEditName(column.name);
                            setIsEditing(false);
                        }
                    }}
                    className="h-7 text-sm"
                />
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className="w-full h-full px-3 py-2 flex items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
                >
                    <span>{column.name}</span>
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem onClick={onSort}>
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Sort
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename
                </DropdownMenuItem>
                {isConfigurable && onConfigure && (
                    <DropdownMenuItem onClick={onConfigure}>
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Options
                    </DropdownMenuItem>
                )}
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Type className="h-4 w-4 mr-2" />
                        Change Type
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        {Object.entries(COLUMN_TYPES).map(([key, config]) => (
                            <DropdownMenuItem
                                key={key}
                                onClick={() => onUpdate({ type: key as ColumnType })}
                            >
                                {config.icon}
                                <span className="ml-2">{config.label}</span>
                                {column.type === key && <Check className="h-4 w-4 ml-auto" />}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Column
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Editable Cell Component
function EditableCell({
    value,
    column,
    onSave,
}: {
    value: any;
    column: DataColumn;
    onSave: (value: any) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value?.toString() || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    useEffect(() => {
        setEditValue(value?.toString() || '');
    }, [value]);

    const handleSave = () => {
        let finalValue: any = editValue;
        if (['number', 'currency', 'percentage'].includes(column.type)) {
            finalValue = parseFloat(editValue) || 0;
        }
        // Format phone numbers automatically
        if (column.type === 'phone' && editValue) {
            finalValue = formatPhoneNumber(editValue);
        }
        if (editValue !== (value?.toString() || '')) {
            onSave(finalValue);
        }
        setIsEditing(false);
    };

    // Status cell - Notion-style with grouped options
    if (column.type === 'status') {
        // Support both new statusConfig and legacy options format
        const statusConfig = column.config?.statusConfig;
        const options = statusConfig?.options || (column.config?.options as StatusOption[] | undefined);
        const current = options?.find((o) => o.value === value);
        const colorStyle = current ? STATUS_COLORS[current.color] || STATUS_COLORS.gray : null;

        // Group options by status group
        const groupedOptions = options?.reduce((acc, opt) => {
            const group = opt.group || 'todo';
            if (!acc[group]) acc[group] = [];
            acc[group].push(opt);
            return acc;
        }, {} as Record<string, StatusOption[]>) || {};

        const groups: Array<'todo' | 'in_progress' | 'complete'> = ['todo', 'in_progress', 'complete'];

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="w-full h-full px-3 py-2 text-left overflow-hidden">
                        {current ? (
                            <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium max-w-full truncate', colorStyle?.bg, colorStyle?.text)}>
                                {current.label}
                            </span>
                        ) : (
                            <span className="text-muted-foreground text-sm">Select...</span>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-w-[280px]">
                    {groups.map((group, groupIndex) => {
                        const groupOptions = groupedOptions[group] || [];
                        if (groupOptions.length === 0) return null;

                        return (
                            <div key={group}>
                                {groupIndex > 0 && <DropdownMenuSeparator />}
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                    {STATUS_GROUP_LABELS[group]}
                                </div>
                                {groupOptions.map((opt) => {
                                    const style = STATUS_COLORS[opt.color] || STATUS_COLORS.gray;
                                    return (
                                        <DropdownMenuItem key={opt.value || opt.id} onClick={() => onSave(opt.value)} className="flex items-center gap-2">
                                            <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium max-w-[180px] truncate', style.bg, style.text)}>
                                                {opt.label}
                                            </span>
                                            {current?.value === opt.value && <Check className="h-4 w-4 ml-auto shrink-0" />}
                                        </DropdownMenuItem>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {value && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onSave(null)}>
                                Clear
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    // Checkbox cell
    if (column.type === 'checkbox') {
        return (
            <button
                className="w-full h-full px-3 py-2 flex items-center"
                onClick={() => onSave(!value)}
            >
                <div
                    className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center transition-colors',
                        value
                            ? 'bg-primary border-primary'
                            : 'border-input hover:border-primary'
                    )}
                >
                    {value && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
            </button>
        );
    }

    // Email cell
    if (column.type === 'email' && value) {
        return (
            <div className="px-3 py-2 flex items-center gap-2 group">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-blue-600 truncate flex-1">{value}</span>
                <button
                    onClick={() => navigator.clipboard.writeText(value)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                >
                    <Copy className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    // Phone cell
    if (column.type === 'phone' && value) {
        return (
            <div className="px-3 py-2 flex items-center gap-2 group">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm truncate flex-1">{value}</span>
                <button
                    onClick={() => navigator.clipboard.writeText(value)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                >
                    <Copy className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    // URL cell
    if (column.type === 'url' && value) {
        return (
            <div className="px-3 py-2 flex items-center gap-2 group">
                <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate flex-1"
                >
                    {value}
                </a>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
        );
    }

    // Percentage cell (display with color like in screenshot)
    if (column.type === 'percentage') {
        const numValue = parseFloat(value) || 0;
        let colorClass = 'text-red-600';
        if (numValue >= 80) colorClass = 'text-emerald-600';
        else if (numValue >= 50) colorClass = 'text-amber-600';
        else if (numValue >= 20) colorClass = 'text-orange-600';

        if (!isEditing && value != null) {
            return (
                <div
                    className="px-3 py-2 cursor-text"
                    onClick={() => setIsEditing(true)}
                >
                    <span className={cn('text-sm font-medium', colorClass)}>
                        {numValue}%
                    </span>
                </div>
            );
        }
    }

    // Editing state
    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                type={['number', 'currency', 'percentage'].includes(column.type) ? 'number' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') {
                        setEditValue(value?.toString() || '');
                        setIsEditing(false);
                    }
                }}
                className="h-full w-full border-0 rounded-none shadow-none focus-visible:ring-2 focus-visible:ring-primary px-3"
            />
        );
    }

    // Display value
    let displayValue = value;
    if (column.type === 'currency' && value) {
        displayValue = `$${Number(value).toLocaleString()}`;
    }
    if (column.type === 'date' && value) {
        displayValue = new Date(value).toLocaleDateString();
    }
    if (column.type === 'number' && value != null) {
        displayValue = Number(value).toLocaleString();
    }

    return (
        <div
            className="px-3 py-2 cursor-text min-h-[40px] flex items-center overflow-hidden"
            onClick={() => setIsEditing(true)}
        >
            <span className={cn('text-sm truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
                {displayValue || ''}
            </span>
        </div>
    );
}

// Progress Indicator Cell - shows mini sparkline/summary and opens period dialog
function ProgressIndicatorCell({
    rowId,
    rowName,
    timeTracking,
    periods,
    onOpenDialog,
}: {
    rowId: string;
    rowName: string;
    timeTracking: TimeTrackingConfig;
    periods?: PeriodData[];
    onOpenDialog?: (rowId: string, rowName: string) => void;
}) {
    const currentMonth = new Date().getMonth();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Ensure periods is an array
    const periodsArray = Array.isArray(periods) ? periods : [];

    // Calculate totals for display
    const totals: Record<string, number> = {};
    timeTracking.metrics.forEach(m => {
        totals[m.id] = periodsArray.reduce((sum, p) => sum + (p.metrics[m.id] || 0), 0);
    });

    // Get the first metric total for display
    const firstMetric = timeTracking.metrics[0];
    const total = firstMetric ? totals[firstMetric.id] : 0;

    // Find current period
    const currentPeriod = periodsArray.find(p => {
        const start = new Date(p.period_start);
        return start.getMonth() === currentMonth;
    });

    const currentValue = currentPeriod && firstMetric ? currentPeriod.metrics[firstMetric.id] || 0 : 0;

    return (
        <button
            onClick={() => onOpenDialog?.(rowId, rowName)}
            className="w-full h-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors group"
            title="Click to view/edit period data"
        >
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium text-foreground">{total}</span>
                <span className="text-[10px] text-muted-foreground truncate">
                    {monthNames[currentMonth]}: {currentValue}
                </span>
            </div>
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-blue-500 font-medium">Edit</span>
            </div>
        </button>
    );
}

// Virtualized Row Component - memoized for performance
interface VirtualRowProps {
    row: DataRow;
    columns: DataColumn[];
    columnWidths: Record<string, number>;
    isSelected: boolean;
    onToggleRow: (rowId: string) => void;
    onUpdateRow: (rowId: string, data: Record<string, any>) => void;
    hasTimeTracking: boolean;
    timeTracking?: TimeTrackingConfig | null;
    periodData?: Record<string, PeriodData[]>;
    onOpenPeriodDialog?: (rowId: string, rowName: string) => void;
    style: React.CSSProperties;
}

const VirtualRow = memo(function VirtualRow({
    row,
    columns,
    columnWidths,
    isSelected,
    onToggleRow,
    onUpdateRow,
    hasTimeTracking,
    timeTracking,
    periodData,
    onOpenPeriodDialog,
    style,
}: VirtualRowProps) {
    return (
        <div
            className={cn(
                'flex border-b last:border-b-0 transition-colors',
                isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'
            )}
            style={style}
        >
            {/* Checkbox and Expand */}
            <div className="w-[40px] shrink-0 px-2 flex items-center gap-1">
                <button
                    onClick={() => onToggleRow(row.id)}
                    className="flex items-center justify-center"
                >
                    <div
                        className={cn(
                            'h-4 w-4 rounded border flex items-center justify-center transition-colors',
                            isSelected
                                ? 'bg-primary border-primary'
                                : 'border-input hover:border-primary'
                        )}
                    >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                </button>
            </div>

            {/* Data cells */}
            {columns.map((col) => (
                <div
                    key={col.id}
                    className="border-l shrink-0 overflow-hidden"
                    style={{ width: columnWidths[col.id] || DEFAULT_COLUMN_WIDTH }}
                >
                    <EditableCell
                        value={row.data[col.id]}
                        column={col}
                        onSave={(value) => onUpdateRow(row.id, { [col.id]: value })}
                    />
                </div>
            ))}

            {/* Progress cell for time tracking */}
            {hasTimeTracking && timeTracking && (
                <div className="border-l shrink-0" style={{ width: 130 }}>
                    <ProgressIndicatorCell
                        rowId={row.id}
                        rowName={row.data[columns.find(c => c.is_primary)?.id || columns[0]?.id] || 'Item'}
                        timeTracking={timeTracking}
                        periods={periodData?.[row.id]}
                        onOpenDialog={onOpenPeriodDialog}
                    />
                </div>
            )}

            {/* Empty cell for add column button alignment */}
            <div className="w-[40px] shrink-0"></div>
        </div>
    );
});

// Main DataGrid Component with Virtualization
export function DataGrid({
    tableId,
    columns,
    rows,
    onAddRow,
    onUpdateRow,
    onDeleteRow,
    onAddColumn,
    onUpdateColumn,
    onDeleteColumn,
    timeTracking,
    periodData,
    onOpenPeriodDialog,
    onConfigureTimeTracking,
    isAddingRow = false,
    isAddingColumn = false,
}: DataGridProps) {
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [configColumn, setConfigColumn] = useState<DataColumn | null>(null);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);

    // Column widths state - initialize from column data or default
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        const widths: Record<string, number> = {};
        columns.forEach(col => {
            widths[col.id] = col.width || DEFAULT_COLUMN_WIDTH;
        });
        return widths;
    });

    // Update column widths when columns change (new columns added)
    useEffect(() => {
        setColumnWidths(prev => {
            const newWidths = { ...prev };
            columns.forEach(col => {
                if (!(col.id in newWidths)) {
                    newWidths[col.id] = col.width || DEFAULT_COLUMN_WIDTH;
                }
            });
            return newWidths;
        });
    }, [columns]);

    // Ref for the scrollable container
    const parentRef = useRef<HTMLDivElement>(null);

    // Handle column resize
    const handleColumnResize = useCallback((columnId: string, delta: number) => {
        setColumnWidths(prev => {
            const currentWidth = prev[columnId] || DEFAULT_COLUMN_WIDTH;
            const newWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, currentWidth + delta));
            return { ...prev, [columnId]: newWidth };
        });
    }, []);

    // Persist column width to database when resize ends
    const handleResizeEnd = useCallback((columnId: string) => {
        const newWidth = columnWidths[columnId];
        if (newWidth) {
            onUpdateColumn(columnId, { width: newWidth });
        }
    }, [columnWidths, onUpdateColumn]);

    // Check if time tracking is enabled
    const hasTimeTracking = timeTracking?.enabled;

    const handleOpenConfig = (column: DataColumn) => {
        setConfigColumn(column);
        setConfigDialogOpen(true);
    };

    const handleSaveConfig = (columnId: string, config: ColumnConfig) => {
        onUpdateColumn(columnId, { config });
        setConfigDialogOpen(false);
        setConfigColumn(null);
    };

    const handleSort = (columnId: string) => {
        if (sortColumn === columnId) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnId);
            setSortDirection('asc');
        }
    };

    const toggleRow = useCallback((rowId: string) => {
        setSelectedRows((prev) => {
            const next = new Set(prev);
            if (next.has(rowId)) {
                next.delete(rowId);
            } else {
                next.add(rowId);
            }
            return next;
        });
    }, []);

    const toggleAll = () => {
        if (selectedRows.size === rows.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(rows.map((r) => r.id)));
        }
    };

    const handleDeleteSelected = () => {
        selectedRows.forEach((rowId) => onDeleteRow(rowId));
        setSelectedRows(new Set());
    };

    const handleDuplicateSelected = () => {
        // For now, just add new rows - in a real app you'd copy the data
        selectedRows.forEach(() => onAddRow());
        setSelectedRows(new Set());
    };

    const handleArchiveSelected = () => {
        // Archive functionality - could be implemented as a status change
        // For now, we'll just clear selection
        setSelectedRows(new Set());
    };

    const allSelected = rows.length > 0 && selectedRows.size === rows.length;
    const someSelected = selectedRows.size > 0;

    // Sort rows - memoized for performance
    const sortedRows = useMemo(() => {
        return [...rows].sort((a, b) => {
            if (!sortColumn) return 0;
            const aVal = a.data[sortColumn];
            const bVal = b.data[sortColumn];
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [rows, sortColumn, sortDirection]);

    // Calculate total width for the table
    const totalWidth = useMemo(() => {
        const colWidthsSum = columns.reduce((sum, col) => sum + (columnWidths[col.id] || DEFAULT_COLUMN_WIDTH), 0);
        const checkboxWidth = 40;
        const addColumnWidth = 40;
        const progressWidth = hasTimeTracking ? 130 : 0;
        return colWidthsSum + checkboxWidth + addColumnWidth + progressWidth;
    }, [columns, columnWidths, hasTimeTracking]);

    // Calculate visible height - limit to MAX_VISIBLE_ROWS
    const visibleHeight = Math.min(sortedRows.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT;

    // Virtualizer setup
    const rowVirtualizer = useVirtualizer({
        count: sortedRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: OVERSCAN,
    });

    return (
        <div className="w-full relative">
            {/* Selection Action Bar */}
            {someSelected && (
                <div className="absolute -top-12 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg">
                    <span className="text-sm font-medium">
                        {selectedRows.size} item{selectedRows.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleDuplicateSelected}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded hover:bg-white/20 transition-colors"
                        >
                            <Copy className="h-4 w-4" />
                            <span>Duplicate</span>
                        </button>
                        <button
                            onClick={handleArchiveSelected}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded hover:bg-white/20 transition-colors"
                        >
                            <Archive className="h-4 w-4" />
                            <span>Archive</span>
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded hover:bg-white/20 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                        </button>
                        <div className="w-px h-5 bg-white/30 mx-1" />
                        <button
                            onClick={() => setSelectedRows(new Set())}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-sm rounded hover:bg-white/20 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="border rounded-lg overflow-hidden bg-card" data-onboarding="data-grid">
                <div className="overflow-x-auto">
                    {/* Sticky Header */}
                    <div
                        className="flex border-b bg-muted/30 sticky top-0 z-10"
                        style={{ minWidth: totalWidth }}
                    >
                        {/* Checkbox column */}
                        <div className="w-[40px] shrink-0 px-3 py-2 flex items-center">
                            <button
                                onClick={toggleAll}
                                className="flex items-center justify-center"
                            >
                                <div
                                    className={cn(
                                        'h-4 w-4 rounded border flex items-center justify-center transition-colors',
                                        allSelected
                                            ? 'bg-primary border-primary'
                                            : 'border-input hover:border-primary'
                                    )}
                                >
                                    {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                            </button>
                        </div>

                        {/* Column headers */}
                        {columns.map((col) => (
                            <div
                                key={col.id}
                                className="text-left font-medium border-l shrink-0 relative"
                                style={{ width: columnWidths[col.id] || DEFAULT_COLUMN_WIDTH }}
                            >
                                <ColumnHeader
                                    column={col}
                                    onUpdate={(updates) => onUpdateColumn(col.id, updates)}
                                    onDelete={() => onDeleteColumn(col.id)}
                                    sortDirection={sortColumn === col.id ? sortDirection : null}
                                    onSort={() => handleSort(col.id)}
                                    onConfigure={() => handleOpenConfig(col)}
                                />
                                <ColumnResizeHandle
                                    onResize={(delta) => handleColumnResize(col.id, delta)}
                                    onResizeEnd={() => handleResizeEnd(col.id)}
                                />
                            </div>
                        ))}

                        {/* Progress column for time tracking */}
                        {hasTimeTracking && (
                            <div className="text-left font-medium border-l group/progress shrink-0" style={{ width: 130 }} data-onboarding="period-tracker">
                                <div className="px-3 py-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                                    <BarChart3 className="h-4 w-4 text-blue-500" />
                                    <span className="flex-1">Progress</span>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover/progress:opacity-100 hover:bg-muted transition-all" data-onboarding="time-tracking-config">
                                                <Settings className="h-3.5 w-3.5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={onConfigureTimeTracking}>
                                                <Settings className="h-3.5 w-3.5 mr-2" />
                                                Configure Metrics
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={onConfigureTimeTracking}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                Remove Progress Tracking
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        )}

                        {/* Add column button */}
                        <div className="w-[40px] shrink-0 border-l">
                            <AddColumnDialog
                                onAdd={onAddColumn}
                                onConfigureTimeTracking={onConfigureTimeTracking}
                                hasTimeTracking={hasTimeTracking}
                            />
                        </div>
                    </div>

                    {/* Virtualized Body */}
                    {sortedRows.length > 0 ? (
                        <div
                            ref={parentRef}
                            className="overflow-y-auto virtual-scroll"
                            style={{
                                height: visibleHeight,
                                minWidth: totalWidth,
                            }}
                        >
                            <div
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const row = sortedRows[virtualRow.index];
                                    const isSelected = selectedRows.has(row.id);

                                    return (
                                        <VirtualRow
                                            key={row.id}
                                            row={row}
                                            columns={columns}
                                            columnWidths={columnWidths}
                                            isSelected={isSelected}
                                            onToggleRow={toggleRow}
                                            onUpdateRow={onUpdateRow}
                                            hasTimeTracking={!!hasTimeTracking}
                                            timeTracking={timeTracking}
                                            periodData={periodData}
                                            onOpenPeriodDialog={onOpenPeriodDialog}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: `${virtualRow.size}px`,
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* Empty state */
                        <div
                            className="text-center py-8 text-muted-foreground"
                            style={{ minWidth: totalWidth }}
                        >
                            No data yet. Click below to add your first row.
                        </div>
                    )}
                </div>

                {/* Add Row Button */}
                <div className="border-t">
                    <button
                        onClick={onAddRow}
                        disabled={isAddingRow}
                        className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAddingRow ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="h-4 w-4" />
                        )}
                        <span>{isAddingRow ? 'Adding...' : 'Add new row'}</span>
                    </button>
                </div>
            </div>

            {/* Column Configuration Dialog */}
            <ColumnConfigDialog
                open={configDialogOpen}
                onOpenChange={setConfigDialogOpen}
                column={configColumn}
                onSave={handleSaveConfig}
            />
        </div>
    );
}
