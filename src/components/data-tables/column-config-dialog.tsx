'use client';

import { DataColumn, ColumnConfig, StatusConfig, SelectConfig, StatusOption, SelectOption } from '@/lib/db/types';
import { StatusConfigDialog, DEFAULT_STATUS_OPTIONS } from './status-config-dialog';
import { SelectConfigDialog } from './select-config-dialog';

interface ColumnConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    column: DataColumn | null;
    onSave: (columnId: string, config: ColumnConfig) => void;
}

// Helper to migrate legacy status options to new format
function migrateStatusOptions(config: ColumnConfig): StatusConfig {
    // Check if already has new format
    if (config.statusConfig) {
        return config.statusConfig;
    }

    // Migrate from legacy format
    if (config.options && Array.isArray(config.options)) {
        const legacyOptions = config.options as any[];

        // Check if it's the old StatusOption format (without group)
        if (legacyOptions.length > 0 && legacyOptions[0].label) {
            const migratedOptions: StatusOption[] = legacyOptions.map((opt, index) => ({
                id: opt.id || Math.random().toString(36).substring(2, 9),
                value: opt.value,
                label: opt.label,
                color: opt.color || 'gray',
                // Guess group based on color or position
                group: guessStatusGroup(opt.color, opt.label, index, legacyOptions.length),
            }));
            return { options: migratedOptions };
        }
    }

    // Return defaults
    return { options: DEFAULT_STATUS_OPTIONS };
}

// Helper to guess status group from legacy data
function guessStatusGroup(
    color: string | undefined,
    label: string,
    index: number,
    total: number
): 'todo' | 'in_progress' | 'complete' {
    const lowerLabel = label.toLowerCase();

    // Check label keywords
    if (lowerLabel.includes('done') || lowerLabel.includes('complete') || lowerLabel.includes('finished')) {
        return 'complete';
    }
    if (lowerLabel.includes('progress') || lowerLabel.includes('active') || lowerLabel.includes('working')) {
        return 'in_progress';
    }
    if (lowerLabel.includes('todo') || lowerLabel.includes('not started') || lowerLabel.includes('pending')) {
        return 'todo';
    }

    // Check color
    if (color === 'green') return 'complete';
    if (color === 'blue' || color === 'yellow' || color === 'orange') return 'in_progress';
    if (color === 'gray' || color === 'red') return 'todo';

    // Default based on position
    if (index === 0) return 'todo';
    if (index === total - 1) return 'complete';
    return 'in_progress';
}

// Helper to migrate legacy select options to new format
function migrateSelectOptions(config: ColumnConfig): SelectConfig {
    // Check if already has new format
    if (config.selectConfig) {
        return config.selectConfig;
    }

    // Migrate from legacy format (string array)
    if (config.options && Array.isArray(config.options)) {
        if (typeof config.options[0] === 'string') {
            // It's a string array - convert to SelectOption[]
            const colors: Array<'gray' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow' | 'pink'> =
                ['blue', 'green', 'purple', 'orange', 'red', 'yellow', 'pink', 'gray'];

            const migratedOptions: SelectOption[] = (config.options as string[]).map((opt, index) => ({
                id: Math.random().toString(36).substring(2, 9),
                value: opt.toLowerCase().replace(/\s+/g, '_'),
                label: opt,
                color: colors[index % colors.length],
            }));
            return { options: migratedOptions };
        }

        // It might already be SelectOption-like
        const options = config.options as any[];
        if (options.length > 0 && options[0].label) {
            const migratedOptions: SelectOption[] = options.map((opt, index) => ({
                id: opt.id || Math.random().toString(36).substring(2, 9),
                value: opt.value || opt.label?.toLowerCase().replace(/\s+/g, '_'),
                label: opt.label,
                color: opt.color || ['blue', 'green', 'purple', 'orange'][index % 4],
            }));
            return { options: migratedOptions };
        }
    }

    // Return empty
    return { options: [] };
}

export function ColumnConfigDialog({
    open,
    onOpenChange,
    column,
    onSave,
}: ColumnConfigDialogProps) {
    if (!column) return null;

    const handleStatusSave = (statusConfig: StatusConfig) => {
        onSave(column.id, {
            ...column.config,
            statusConfig,
            // Also update legacy options for backwards compatibility
            options: statusConfig.options,
        });
    };

    const handleSelectSave = (selectConfig: SelectConfig) => {
        onSave(column.id, {
            ...column.config,
            selectConfig,
            // Also update legacy options for backwards compatibility
            options: selectConfig.options,
        });
    };

    // Route to appropriate config dialog based on column type
    switch (column.type) {
        case 'status':
            return (
                <StatusConfigDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    config={migrateStatusOptions(column.config)}
                    onSave={handleStatusSave}
                    columnName={column.name}
                />
            );

        case 'select':
            return (
                <SelectConfigDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    config={migrateSelectOptions(column.config)}
                    onSave={handleSelectSave}
                    columnName={column.name}
                    isMultiSelect={false}
                />
            );

        case 'multi_select':
            return (
                <SelectConfigDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    config={migrateSelectOptions(column.config)}
                    onSave={handleSelectSave}
                    columnName={column.name}
                    isMultiSelect={true}
                />
            );

        default:
            // For other column types, we can add more config dialogs later
            // For now, just close the dialog
            return null;
    }
}
