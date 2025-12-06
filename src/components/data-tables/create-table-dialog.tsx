'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTemplate } from '@/lib/db/types';
import {
    UserRound,
    Building2,
    Users,
    MessageCircle,
    CheckSquare,
    Table,
    Plus,
} from 'lucide-react';
import { DataColumn } from '@/lib/db/types';

const STORAGE_KEY_PREFIX = 'activity-contact-source-';

// Auto-detect contact columns based on name and type
function detectContactColumns(columns: DataColumn[]): {
    nameColumnId?: string;
    emailColumnId?: string;
    phoneColumnId?: string;
} {
    const result: {
        nameColumnId?: string;
        emailColumnId?: string;
        phoneColumnId?: string;
    } = {};

    for (const col of columns) {
        const nameLower = col.name.toLowerCase();

        // Detect name column
        if (!result.nameColumnId) {
            if (nameLower === 'name' || nameLower === 'full name' || nameLower === 'contact name' || nameLower === 'attendee') {
                result.nameColumnId = col.id;
            }
        }

        // Detect email column
        if (!result.emailColumnId) {
            if (col.type === 'email' || nameLower === 'email' || nameLower.includes('email')) {
                result.emailColumnId = col.id;
            }
        }

        // Detect phone column
        if (!result.phoneColumnId) {
            if (col.type === 'phone' || nameLower === 'phone' || nameLower.includes('phone')) {
                result.phoneColumnId = col.id;
            }
        }
    }

    return result;
}

const iconMap: Record<string, React.ReactNode> = {
    'user-round': <UserRound className="h-5 w-5" />,
    'building-2': <Building2 className="h-5 w-5" />,
    'users': <Users className="h-5 w-5" />,
    'message-circle': <MessageCircle className="h-5 w-5" />,
    'check-square': <CheckSquare className="h-5 w-5" />,
    'table': <Table className="h-5 w-5" />,
};

// Using design system CSS variables for consistent theming
const colorMap: Record<string, string> = {
    blue: 'bg-[var(--notion-blue)] text-[var(--notion-blue-text)] border-[var(--notion-blue)]',
    purple: 'bg-[var(--notion-purple)] text-[var(--notion-purple-text)] border-[var(--notion-purple)]',
    green: 'bg-[var(--notion-green)] text-[var(--notion-green-text)] border-[var(--notion-green)]',
    orange: 'bg-[var(--notion-orange)] text-[var(--notion-orange-text)] border-[var(--notion-orange)]',
    indigo: 'bg-[var(--notion-purple)] text-[var(--notion-purple-text)] border-[var(--notion-purple)]',
};

interface CreateTableDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    onTableCreated: () => void;
}

export function CreateTableDialog({
    open,
    onOpenChange,
    clientId,
    onTableCreated,
}: CreateTableDialogProps) {
    const [templates, setTemplates] = useState<DataTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [mode, setMode] = useState<'templates' | 'custom'>('templates');
    const [customName, setCustomName] = useState('');

    useEffect(() => {
        if (open) {
            fetchTemplates();
        }
    }, [open]);

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/templates');
            const data = await response.json();
            setTemplates(data.templates || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveContactSourceConfig = (tableId: string, tableName: string, columns: DataColumn[]) => {
        const detected = detectContactColumns(columns);

        // Only save if we detected at least a name column
        if (detected.nameColumnId) {
            const config = {
                tableId,
                tableName,
                nameColumnId: detected.nameColumnId,
                emailColumnId: detected.emailColumnId,
                phoneColumnId: detected.phoneColumnId,
            };
            localStorage.setItem(`${STORAGE_KEY_PREFIX}${clientId}`, JSON.stringify(config));
        }
    };

    const createFromTemplate = async (templateId: string) => {
        setCreating(true);
        try {
            const response = await fetch('/api/data-tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    template_id: templateId,
                }),
            });

            if (response.ok) {
                const { table } = await response.json();
                // Auto-save contact source config
                if (table?.columns) {
                    saveContactSourceConfig(table.id, table.name, table.columns);
                }
                onTableCreated();
                onOpenChange(false);
                setMode('templates');
            }
        } catch (error) {
            console.error('Error creating table:', error);
        } finally {
            setCreating(false);
        }
    };

    const createCustomTable = async () => {
        if (!customName.trim()) return;

        setCreating(true);
        try {
            const response = await fetch('/api/data-tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    name: customName.trim(),
                }),
            });

            if (response.ok) {
                const { table } = await response.json();
                // Auto-save contact source config if columns detected
                if (table?.columns) {
                    saveContactSourceConfig(table.id, table.name, table.columns);
                }
                onTableCreated();
                onOpenChange(false);
                setCustomName('');
                setMode('templates');
            }
        } catch (error) {
            console.error('Error creating table:', error);
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Create a Data Table</DialogTitle>
                </DialogHeader>

                <div className="p-4 pt-4">
                {mode === 'templates' ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Start with a template or create a blank table
                        </p>

                        {/* Templates Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-24 rounded-lg border border-border bg-muted/30 animate-pulse"
                                    />
                                ))
                            ) : (
                                templates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => createFromTemplate(template.id)}
                                        disabled={creating}
                                        className={`relative flex flex-col items-start gap-2 p-4 rounded-lg border transition-all hover:shadow-md disabled:opacity-50 ${colorMap[template.color] || colorMap.blue}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {iconMap[template.icon] || iconMap.table}
                                            <span className="font-medium text-sm">
                                                {template.name}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground text-left line-clamp-2">
                                            {template.description}
                                        </p>
                                        <div className="text-[10px] text-muted-foreground">
                                            {template.columns?.length || 0} columns
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Create Blank */}
                        <div className="pt-2 border-t">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
                                onClick={() => setMode('custom')}
                            >
                                <Plus className="h-4 w-4" />
                                Create blank table
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="table-name">Table Name</Label>
                            <Input
                                id="table-name"
                                placeholder="e.g., Customers, Leads, Projects..."
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        createCustomTable();
                                    }
                                }}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setMode('templates')}
                                disabled={creating}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={createCustomTable}
                                disabled={!customName.trim() || creating}
                                className="flex-1"
                            >
                                Create Table
                            </Button>
                        </div>
                    </div>
                )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
