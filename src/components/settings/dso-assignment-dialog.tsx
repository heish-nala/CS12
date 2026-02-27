'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { OrgMemberWithProfile } from '@/lib/db/types';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';

interface DsoAssignmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: OrgMemberWithProfile | null;
    orgId: string;
    allDsos: Array<{ id: string; name: string }>;
    currentAssignments: string[]; // dso_ids
    onSave: () => void;
}

export function DsoAssignmentDialog({
    open,
    onOpenChange,
    member,
    orgId,
    allDsos,
    currentAssignments,
    onSave,
}: DsoAssignmentDialogProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set(currentAssignments));
    const [saving, setSaving] = useState(false);

    // Reset selection when dialog opens or assignments change
    useEffect(() => {
        if (open) {
            setSelected(new Set(currentAssignments));
        }
    }, [open, currentAssignments]);

    const handleToggle = (dsoId: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(dsoId)) {
                next.delete(dsoId);
            } else {
                next.add(dsoId);
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!member) return;

        const currentSet = new Set(currentAssignments);
        const toAdd = [...selected].filter((id) => !currentSet.has(id));
        const toRemove = currentAssignments.filter((id) => !selected.has(id));

        // No changes — just close
        if (toAdd.length === 0 && toRemove.length === 0) {
            onOpenChange(false);
            return;
        }

        setSaving(true);
        try {
            const addRequests = toAdd.map((dsoId) =>
                fetch(`/api/orgs/${orgId}/dso-access`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: member.user_id, dso_id: dsoId }),
                })
            );

            const removeRequests = toRemove.map((dsoId) =>
                fetch(
                    `/api/orgs/${orgId}/dso-access?user_id=${member.user_id}&dso_id=${dsoId}`,
                    { method: 'DELETE' }
                )
            );

            const results = await Promise.all([...addRequests, ...removeRequests]);

            const anyFailed = results.some((res) => !res.ok);
            if (anyFailed) {
                toast.error('Some changes failed. Please try again.');
            } else {
                toast.success('DSO assignments updated');
            }

            onSave();
        } catch (error) {
            console.error('Error saving DSO assignments:', error);
            toast.error('Failed to save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const memberName =
        member?.user_profiles?.name ||
        member?.user_profiles?.email ||
        'Member';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Manage DSO Access — {memberName}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-1 max-h-[400px] overflow-y-auto">
                    {allDsos.map((dso) => (
                        <label
                            key={dso.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                        >
                            <Checkbox
                                id={`dso-${dso.id}`}
                                checked={selected.has(dso.id)}
                                onCheckedChange={() => handleToggle(dso.id)}
                                disabled={saving}
                            />
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Label
                                htmlFor={`dso-${dso.id}`}
                                className="text-sm text-foreground cursor-pointer flex-1"
                            >
                                {dso.name}
                            </Label>
                        </label>
                    ))}

                    {allDsos.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No DSOs in this organization yet
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
