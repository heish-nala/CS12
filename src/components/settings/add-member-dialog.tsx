'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserRole } from '@/lib/db/types';
import { Mail, Shield, UserCog, Eye, Send } from 'lucide-react';

interface AddMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    existingEmails: string[];
    availableDsos: { id: string; name: string }[];
    currentUserId?: string;
    currentUserName?: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string; icon: React.ReactNode; description: string }[] = [
    {
        value: 'viewer',
        label: 'Viewer',
        icon: <Eye className="h-4 w-4" />,
        description: 'Can view all data but cannot make changes',
    },
    {
        value: 'manager',
        label: 'Manager',
        icon: <UserCog className="h-4 w-4" />,
        description: 'Can create and edit data, but cannot delete or manage team',
    },
    {
        value: 'admin',
        label: 'Admin',
        icon: <Shield className="h-4 w-4" />,
        description: 'Full access including team management and deletion',
    },
];

export function AddMemberDialog({
    open,
    onOpenChange,
    existingEmails,
    availableDsos,
    currentUserId,
    currentUserName,
}: AddMemberDialogProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('viewer');
    const [selectedDsoIds, setSelectedDsoIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const allDsoIds = useMemo(() => availableDsos.map((dso) => dso.id), [availableDsos]);
    const showDsoChecklist = availableDsos.length > 1;
    const allSelected = availableDsos.length > 0 && selectedDsoIds.length === availableDsos.length;

    useEffect(() => {
        setSelectedDsoIds(allDsoIds);
    }, [allDsoIds, open]);

    const resetForm = () => {
        setEmail('');
        setRole('viewer');
        setSelectedDsoIds(allDsoIds);
    };

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('Please enter an email address');
            return;
        }

        if (!validateEmail(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        if (existingEmails.includes(email.toLowerCase())) {
            toast.error('This user is already a team member');
            return;
        }

        if (selectedDsoIds.length === 0) {
            toast.error('Select at least one workspace');
            return;
        }

        if (availableDsos.length === 0) {
            toast.error('Unable to send invite. Please try again later.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/team/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    role,
                    dso_ids: selectedDsoIds,
                    invited_by: currentUserId,
                    inviter_name: currentUserName,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.added_directly) {
                    toast.success(data.message || `${email} has been added to the workspace`);
                } else {
                    toast.success(data.message || `Invitation sent to ${email}`);
                }
                handleClose();
            } else {
                toast.error(data.error || 'Failed to send invitation');
            }
        } catch (error) {
            console.error('Error in handleSubmit:', error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const toggleDso = (dsoId: string) => {
        setSelectedDsoIds((current) =>
            current.includes(dsoId)
                ? current.filter((id) => id !== dsoId)
                : [...current, dsoId]
        );
    };

    const toggleSelectAll = () => {
        setSelectedDsoIds(allSelected ? [] : allDsoIds);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                        Add a new member to your workspace
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 pt-4 space-y-4">
                <form id="add-member-form" onSubmit={handleSubmit} className="space-y-4">
                    {/* Email Input */}
                    <div className="space-y-2">
                        <Label htmlFor="email">
                            <Mail className="h-4 w-4 inline mr-2" />
                            Email Address
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="colleague@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={(v: UserRole) => setRole(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                            {option.icon}
                                            <div>
                                                <div className="font-medium">{option.label}</div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {ROLE_OPTIONS.find(o => o.value === role)?.description}
                        </p>
                    </div>

                    {showDsoChecklist && (
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <Label>Workspace Access</Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Select which workspaces this member can access
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto px-2 py-1 text-xs"
                                    onClick={toggleSelectAll}
                                    disabled={loading}
                                >
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>

                            <div className={`space-y-1 rounded-lg border border-border p-2 ${availableDsos.length > 5 ? 'max-h-48 overflow-y-auto' : ''}`}>
                                {availableDsos.map((dso) => (
                                    <label
                                        key={dso.id}
                                        htmlFor={`invite-dso-${dso.id}`}
                                        className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40 cursor-pointer"
                                    >
                                        <Checkbox
                                            id={`invite-dso-${dso.id}`}
                                            checked={selectedDsoIds.includes(dso.id)}
                                            onCheckedChange={() => toggleDso(dso.id)}
                                            disabled={loading}
                                        />
                                        <span className="text-sm text-foreground">{dso.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="rounded-lg border border-border p-3 bg-muted/30">
                        <p className="text-sm text-muted-foreground">
                            An email invitation will be sent. The user will need to create an account
                            or sign in to join the selected workspace{selectedDsoIds.length === 1 ? '' : 's'}.
                        </p>
                    </div>

                </form>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" form="add-member-form" disabled={loading}>
                        {loading ? (
                            'Sending...'
                        ) : (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Send Invite
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
