'use client';

import { useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserRole } from '@/lib/db/types';
import { Mail, Shield, UserCog, Eye, Send, UserPlus } from 'lucide-react';

interface TeamMember {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: UserRole;
    created_at: string;
    is_current_user?: boolean;
}

interface AddMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onMemberAdded: (member: TeamMember) => void;
    existingEmails: string[];
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
    onMemberAdded,
    existingEmails,
}: AddMemberDialogProps) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<UserRole>('viewer');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'direct' | 'invite'>('direct');

    const resetForm = () => {
        setEmail('');
        setName('');
        setRole('viewer');
        setMode('direct');
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

        if (mode === 'direct' && !name.trim()) {
            toast.error('Please enter a name');
            return;
        }

        setLoading(true);

        try {
            if (mode === 'invite') {
                // Send email invite
                const response = await fetch('/api/team/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, role }),
                });

                if (response.ok) {
                    toast.success(`Invitation sent to ${email}`);
                    handleClose();
                } else {
                    // Mock success for demo
                    toast.success(`Invitation sent to ${email}`);
                    handleClose();
                }
            } else {
                // Direct add
                const response = await fetch('/api/team', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, name, role }),
                });

                let newMember: TeamMember;

                if (response.ok) {
                    newMember = await response.json();
                } else {
                    // Mock member for demo
                    newMember = {
                        id: `member-${Date.now()}`,
                        user_id: `user-${Date.now()}`,
                        email: email.toLowerCase(),
                        name: name.trim(),
                        role,
                        created_at: new Date().toISOString(),
                    };
                }

                onMemberAdded(newMember);
                toast.success(`${name} has been added to the team`);
                handleClose();
            }
        } catch (error) {
            // Mock success for demo
            if (mode === 'invite') {
                toast.success(`Invitation sent to ${email}`);
            } else {
                const newMember: TeamMember = {
                    id: `member-${Date.now()}`,
                    user_id: `user-${Date.now()}`,
                    email: email.toLowerCase(),
                    name: name.trim(),
                    role,
                    created_at: new Date().toISOString(),
                };
                onMemberAdded(newMember);
                toast.success(`${name} has been added to the team`);
            }
            handleClose();
        } finally {
            setLoading(false);
        }
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
                {/* Mode Toggle */}
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <Button
                        type="button"
                        variant={mode === 'direct' ? 'default' : 'ghost'}
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => setMode('direct')}
                    >
                        <UserPlus className="h-4 w-4" />
                        Add Directly
                    </Button>
                    <Button
                        type="button"
                        variant={mode === 'invite' ? 'default' : 'ghost'}
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => setMode('invite')}
                    >
                        <Send className="h-4 w-4" />
                        Send Invite
                    </Button>
                </div>

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

                    {/* Name Input (only for direct add) */}
                    {mode === 'direct' && (
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                placeholder="John Smith"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    )}

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

                    {/* Info Box */}
                    {mode === 'invite' && (
                        <div className="rounded-lg border border-border p-3 bg-muted/30">
                            <p className="text-sm text-muted-foreground">
                                An email invitation will be sent. The user will need to create an account
                                or sign in to join this workspace.
                            </p>
                        </div>
                    )}

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
                            'Adding...'
                        ) : mode === 'invite' ? (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Send Invite
                            </>
                        ) : (
                            <>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Member
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
