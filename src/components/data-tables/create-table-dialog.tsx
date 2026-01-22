'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DataColumn } from '@/lib/db/types';
import {
    Users,
    FileSpreadsheet,
    Loader2,
} from 'lucide-react';

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

interface CreateTableDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    onTableCreated: () => void;
    onUploadCSV?: () => void;
}

export function CreateTableDialog({
    open,
    onOpenChange,
    clientId,
    onTableCreated,
    onUploadCSV,
}: CreateTableDialogProps) {
    const [creating, setCreating] = useState(false);

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

    const createBlankAttendeeList = async () => {
        setCreating(true);
        try {
            const response = await fetch('/api/data-tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    type: 'attendee_list',
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
            }
        } catch (error) {
            console.error('Error creating table:', error);
        } finally {
            setCreating(false);
        }
    };

    const handleUploadCSV = () => {
        onOpenChange(false);
        if (onUploadCSV) {
            onUploadCSV();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Attendees</DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Your list should include <span className="font-medium text-foreground">Name</span>, <span className="font-medium text-foreground">Email</span>, and <span className="font-medium text-foreground">Phone</span>. We'll add Blueprint and Status columns for tracking.
                    </p>

                    <div className="grid gap-3">
                        <Button
                            variant="outline"
                            className="w-full h-auto py-4 justify-start gap-3"
                            onClick={createBlankAttendeeList}
                            disabled={creating}
                        >
                            {creating ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <div className="rounded-full bg-primary/10 p-2">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                            )}
                            <div className="text-left">
                                <div className="font-medium">Create Blank List</div>
                                <div className="text-xs text-muted-foreground">Start with an empty attendee list</div>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full h-auto py-4 justify-start gap-3"
                            onClick={handleUploadCSV}
                            disabled={creating}
                        >
                            <div className="rounded-full bg-green-500/10 p-2">
                                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="text-left">
                                <div className="font-medium">Upload CSV</div>
                                <div className="text-xs text-muted-foreground">Import attendees from a spreadsheet</div>
                            </div>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
