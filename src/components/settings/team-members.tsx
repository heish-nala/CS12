'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddMemberDialog } from './add-member-dialog';
import { toast } from 'sonner';
import { UserRole } from '@/lib/db/types';
import { useAuth } from '@/contexts/auth-context';
import {
    Plus,
    MoreHorizontal,
    Shield,
    UserCog,
    Eye,
    Trash2,
    Mail,
    Crown,
    Clock,
    X,
    RefreshCw,
} from 'lucide-react';

interface TeamMember {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: UserRole;
    created_at: string;
    is_current_user?: boolean;
}

interface PendingInvite {
    id: string;
    email: string;
    role: UserRole;
    expires_at: string;
    created_at: string;
}

// Using design system CSS variables for consistent theming
const ROLE_CONFIG: Record<UserRole, { label: string; icon: React.ReactNode; color: string; description: string }> = {
    admin: {
        label: 'Admin',
        icon: <Shield className="h-3.5 w-3.5" />,
        color: 'bg-[var(--notion-purple)] text-[var(--notion-purple-text)]',
        description: 'Full access. Can manage team members and delete data.',
    },
    manager: {
        label: 'Manager',
        icon: <UserCog className="h-3.5 w-3.5" />,
        color: 'bg-[var(--notion-blue)] text-[var(--notion-blue-text)]',
        description: 'Can create and edit. Cannot delete or manage team.',
    },
    viewer: {
        label: 'Viewer',
        icon: <Eye className="h-3.5 w-3.5" />,
        color: 'bg-[var(--notion-gray)] text-[var(--notion-gray-text)]',
        description: 'Read-only access. Can view all data.',
    },
};

export function TeamMembers() {
    const { user } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [updatingRole, setUpdatingRole] = useState<string | null>(null);
    const [currentDsoId, setCurrentDsoId] = useState<string | null>(null);
    const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

    // Current user is admin (for demo purposes)
    const currentUserRole: UserRole = 'admin';
    const canManageTeam = currentUserRole === 'admin';

    // Get display name from email
    const getDisplayName = (email: string) => {
        const name = email.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    useEffect(() => {
        fetchMembers();
    }, [user]);

    const fetchPendingInvites = useCallback(async () => {
        if (!currentDsoId) return;

        try {
            const userIdParam = user?.id ? `&user_id=${user.id}` : '';
            const response = await fetch(`/api/team/invite?dso_id=${currentDsoId}${userIdParam}`);
            if (response.ok) {
                const data = await response.json();
                setPendingInvites(data.invites || []);
            }
        } catch (error) {
            console.error('Error fetching pending invites:', error);
        }
    }, [currentDsoId]);

    const handleCancelInvite = async (inviteId: string) => {
        setCancellingInvite(inviteId);
        try {
            const userIdParam = user?.id ? `&user_id=${user.id}` : '';
            const response = await fetch(`/api/team/invite?id=${inviteId}${userIdParam}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
                toast.success('Invitation cancelled');
            } else {
                toast.error('Failed to cancel invitation');
            }
        } catch (error) {
            toast.error('Failed to cancel invitation');
        } finally {
            setCancellingInvite(null);
        }
    };

    const getTimeRemaining = (expiresAt: string) => {
        const expires = new Date(expiresAt);
        const now = new Date();
        const diff = expires.getTime() - now.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 1) return `${days} days left`;
        if (days === 1) return '1 day left';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 0) return `${hours} hours left`;
        return 'Expiring soon';
    };

    const fetchMembers = useCallback(async (showLoading = true) => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        if (showLoading) setLoading(true);
        try {
            const response = await fetch(`/api/team?user_id=${user.id}`);
            if (response.ok) {
                const data = await response.json();
                // Store the DSO ID for invites and fetch invites in parallel
                if (data.dso_id) {
                    setCurrentDsoId(data.dso_id);
                    // Fetch invites immediately in parallel
                    fetch(`/api/team/invite?dso_id=${data.dso_id}&user_id=${user.id}`)
                        .then(res => res.ok ? res.json() : { invites: [] })
                        .then(inviteData => setPendingInvites(inviteData.invites || []))
                        .catch(() => setPendingInvites([]));
                }
                if (data.members && data.members.length > 0) {
                    setMembers(data.members);
                } else {
                    // No team members found - show current user as the only member
                    setMembers([{
                        id: user.id,
                        user_id: user.id,
                        email: user.email || '',
                        name: getDisplayName(user.email || 'User'),
                        role: 'admin',
                        created_at: new Date().toISOString(),
                        is_current_user: true,
                    }]);
                }
            } else {
                // Show only current user if API not available
                if (user?.email) {
                    setMembers([{
                        id: user.id,
                        user_id: user.id,
                        email: user.email,
                        name: getDisplayName(user.email),
                        role: 'admin',
                        created_at: new Date().toISOString(),
                        is_current_user: true,
                    }]);
                } else {
                    setMembers([]);
                }
            }
        } catch (error) {
            // Show only current user on error
            if (user?.email) {
                setMembers([{
                    id: user.id,
                    user_id: user.id,
                    email: user.email,
                    name: getDisplayName(user.email),
                    role: 'admin',
                    created_at: new Date().toISOString(),
                    is_current_user: true,
                }]);
            } else {
                setMembers([]);
            }
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.email]);

    // Memoize admin count for performance
    const adminCount = useMemo(() => members.filter(m => m.role === 'admin').length, [members]);

    const handleRoleChange = useCallback(async (memberId: string, newRole: UserRole) => {
        const member = members.find(m => m.id === memberId);
        if (!member || member.role === newRole) return;

        // Prevent demoting the last admin
        if (member.role === 'admin' && adminCount <= 1) {
            toast.error('Cannot change role. At least one admin is required.');
            return;
        }

        setUpdatingRole(memberId);
        try {
            const userIdParam = user?.id ? `?user_id=${user.id}` : '';
            const response = await fetch(`/api/team/${memberId}${userIdParam}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole, user_id: user?.id }),
            });

            if (response.ok) {
                setMembers(prev => prev.map(m =>
                    m.id === memberId ? { ...m, role: newRole } : m
                ));
                toast.success(`Role updated to ${ROLE_CONFIG[newRole].label}`);
            } else {
                toast.error('Failed to update role');
            }
        } catch (error) {
            toast.error('Failed to update role');
        } finally {
            setUpdatingRole(null);
        }
    }, [members, adminCount]);

    const handleRemoveMember = useCallback(async (memberId: string) => {
        const member = members.find(m => m.id === memberId);
        if (!member) return;

        // Prevent removing the last admin
        if (member.role === 'admin' && adminCount <= 1) {
            toast.error('Cannot remove the last admin.');
            return;
        }

        // Prevent removing yourself
        if (member.is_current_user) {
            toast.error('You cannot remove yourself from the team.');
            return;
        }

        try {
            const userIdParam = user?.id ? `?user_id=${user.id}` : '';
            const response = await fetch(`/api/team/${memberId}${userIdParam}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setMembers(prev => prev.filter(m => m.id !== memberId));
                toast.success(`${member.name} has been removed from the team`);
            } else {
                toast.error('Failed to remove team member');
            }
        } catch (error) {
            toast.error('Failed to remove team member');
        }
    }, [members, adminCount]);

    const handleDialogClose = useCallback((open: boolean) => {
        setAddDialogOpen(open);
        // Refresh members and pending invites when dialog closes (no skeleton flash)
        if (!open) {
            fetchMembers(false);
            if (currentDsoId) {
                fetchPendingInvites();
            }
        }
    }, [currentDsoId, fetchPendingInvites, fetchMembers]);

    const getInitials = useCallback((name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-10 bg-muted/50 rounded animate-pulse" />
                <div className="h-20 bg-muted/50 rounded animate-pulse" />
                <div className="h-20 bg-muted/50 rounded animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
                    <p className="text-sm text-muted-foreground">
                        {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
                    </p>
                </div>
                {canManageTeam && (
                    <Button onClick={() => setAddDialogOpen(true)} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Member
                    </Button>
                )}
            </div>

            {/* Role Legend */}
            <div className="flex flex-wrap gap-4 p-4 rounded-lg border border-border bg-muted/30">
                {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                    <div key={role} className="flex items-start gap-2">
                        <Badge variant="outline" className={`${config.color} gap-1`}>
                            {config.icon}
                            {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground max-w-[180px]">
                            {config.description}
                        </span>
                    </div>
                ))}
            </div>

            {/* Member List */}
            <div className="rounded-lg border border-border divide-y divide-border">
                {members.map((member) => {
                    const roleConfig = ROLE_CONFIG[member.role];
                    const isUpdating = updatingRole === member.id;

                    return (
                        <div
                            key={member.id}
                            className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                        >
                            {/* Member Info */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                                    {getInitials(member.name)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">
                                            {member.name}
                                        </span>
                                        {member.is_current_user && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                You
                                            </Badge>
                                        )}
                                        {member.role === 'admin' && (
                                            <Crown className="h-3.5 w-3.5 text-yellow-500" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        {member.email}
                                    </div>
                                </div>
                            </div>

                            {/* Role & Actions */}
                            <div className="flex items-center gap-3">
                                {canManageTeam && !member.is_current_user ? (
                                    <Select
                                        value={member.role}
                                        onValueChange={(value: UserRole) => handleRoleChange(member.id, value)}
                                        disabled={isUpdating}
                                    >
                                        <SelectTrigger className="w-[130px]">
                                            <SelectValue>
                                                <div className="flex items-center gap-2">
                                                    {roleConfig.icon}
                                                    {roleConfig.label}
                                                </div>
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                                                <SelectItem key={role} value={role}>
                                                    <div className="flex items-center gap-2">
                                                        {config.icon}
                                                        {config.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Badge variant="outline" className={`${roleConfig.color} gap-1`}>
                                        {roleConfig.icon}
                                        {roleConfig.label}
                                    </Badge>
                                )}

                                {canManageTeam && !member.is_current_user && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => handleRemoveMember(member.id)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Remove from team
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Pending Invitations ({pendingInvites.length})
                    </h3>
                    <div className="rounded-lg border border-dashed border-border divide-y divide-border">
                        {pendingInvites.map((invite) => {
                            const roleConfig = ROLE_CONFIG[invite.role];
                            const isCancelling = cancellingInvite === invite.id;

                            return (
                                <div
                                    key={invite.id}
                                    className="flex items-center justify-between p-4 bg-muted/20"
                                >
                                    {/* Invite Info */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-foreground">
                                                    {invite.email}
                                                </span>
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                                    Pending
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{getTimeRemaining(invite.expires_at)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Role & Actions */}
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className={`${roleConfig.color} gap-1`}>
                                            {roleConfig.icon}
                                            {roleConfig.label}
                                        </Badge>

                                        {canManageTeam && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleCancelInvite(invite.id)}
                                                disabled={isCancelling}
                                            >
                                                {isCancelling ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <X className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add Member Dialog */}
            <AddMemberDialog
                open={addDialogOpen}
                onOpenChange={handleDialogClose}
                existingEmails={members.map(m => m.email)}
                dsoId={currentDsoId}
                currentUserId={user?.id}
                currentUserName={members.find(m => m.is_current_user)?.name || getDisplayName(user?.email || 'User')}
            />
        </div>
    );
}
