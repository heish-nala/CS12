'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cohort } from '@/lib/db/types';
import { toast } from 'sonner';

interface CreateCohortDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dsoId: string;
    clientName?: string;
    onCreated?: (cohort: Cohort) => void;
}

export function CreateCohortDialog({
    open,
    onOpenChange,
    dsoId,
    clientName,
    onCreated,
}: CreateCohortDialogProps) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState('');

    useEffect(() => {
        if (!open) {
            setName('');
            setStartDate('');
            setLoading(false);
        }
    }, [open]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!name.trim()) {
            toast.error('Cohort name is required');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/cohorts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dso_id: dsoId,
                    name: name.trim(),
                    start_date: startDate || undefined,
                    status: 'active',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create cohort');
            }

            toast.success(`Created ${name.trim()}${clientName ? ` for ${clientName}` : ''}`);
            onCreated?.(data.cohort);
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating cohort:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create cohort');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Add Cohort</DialogTitle>
                    <DialogDescription>
                        Create a new cohort{clientName ? ` for ${clientName}` : ''}.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 p-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="cohort-name">Cohort Name</Label>
                            <Input
                                id="cohort-name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="e.g., Cohort 2"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cohort-start-date">Start Date</Label>
                            <Input
                                id="cohort-start-date"
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Cohort'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
