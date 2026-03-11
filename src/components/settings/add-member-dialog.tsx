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
    const validateEmail = (value: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };

    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('viewer');
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedDsoIds, setSelectedDsoIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const allDsoIds = useMemo(() => availableDsos.map((dso) => dso.id), [availableDsos]);
    const hasMultipleDsos = availableDsos.length > 1;
    const allSelected = availableDsos.length > 0 && selectedDsoIds.length === availableDsos.length;
    const someSelected = selectedDsoIds.length > 0 && !allSelected;
    const canAdvance = validateEmail(email) && !existingEmails.includes(email.toLowerCase());

    useEffect(() => {
        setSelectedDsoIds(allDsoIds);
    }, [allDsoIds, open]);

    const resetForm = () => {
        setEmail('');
        setRole('viewer');
        setStep(1);
        setSelectedDsoIds(allDsoIds);
    };

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    const handleSubmit = async () => {
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

    const handleNext = () => {
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

        if (availableDsos.length === 0) {
            toast.error('Unable to send invite. Please try again later.');
            return;
        }

        if (hasMultipleDsos) {
            setStep(2);
            return;
        }

        void handleSubmit();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                        {step === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 pt-4 space-y-4">
                    <form
                        id="add-member-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (step === 1) {
                                handleNext();
                                return;
                            }

                            void handleSubmit();
                        }}
                        className="space-y-4"
                    >
                        {step === 1 ? (
                            <>
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
                            </>
                        ) : (
                            <>
                                <div className="space-y-1">
                                    <Label>Workspace Access</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Select which workspaces this member can access
                                    </p>
                                </div>

                                <div className="rounded-lg border border-border overflow-hidden">
                                    <label
                                        htmlFor="invite-dso-select-all"
                                        className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30 cursor-pointer"
                                    >
                                        <Checkbox
                                            id="invite-dso-select-all"
                                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                            onCheckedChange={() => {
                                                setSelectedDsoIds(allSelected ? [] : allDsoIds);
                                            }}
                                            disabled={loading}
                                        />
                                        <span className="text-sm font-medium text-foreground">Select All</span>
                                    </label>

                                    <div className={availableDsos.length > 5 ? 'max-h-[240px] overflow-y-auto' : ''}>
                                        {availableDsos.map((dso) => (
                                            <label
                                                key={dso.id}
                                                htmlFor={`invite-dso-${dso.id}`}
                                                className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer"
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

                                <div className="rounded-lg border border-border p-3 bg-muted/30">
                                    <p className="text-sm text-muted-foreground">
                                        An email invitation will be sent. The user will need to create an account or sign in.
                                    </p>
                                </div>
                            </>
                        )}
                    </form>
                </div>

                <DialogFooter>
                    {step === 1 ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="add-member-form"
                                disabled={loading || !canAdvance}
                            >
                                {loading ? (
                                    'Sending...'
                                ) : hasMultipleDsos ? (
                                    'Next'
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Send Invite
                                    </>
                                )}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep(1)}
                                disabled={loading}
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                form="add-member-form"
                                disabled={loading || selectedDsoIds.length === 0}
                            >
                                {loading ? (
                                    'Sending...'
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Send Invite
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
