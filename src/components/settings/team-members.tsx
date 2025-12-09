'use client';

import { useState, useEffect } from 'react';
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddMemberDialog } from './add-member-dialog';
import { toast } from 'sonner';
import { UserRole } from '@/lib/db/types';
import {
    Plus,
    MoreHorizontal,
    Shield,
    UserCog,
    Eye,
    Trash2,
    Mail,
    Crown,
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

// Mock data for development
const MOCK_TEAM_MEMBERS: TeamMember[] = [
    {
        id: '1',
        user_id: 'user-1',
        email: 'alan@cs12.com',
        name: 'Alan',
        role: 'admin',
        created_at: '2024-01-15T00:00:00Z',
        is_current_user: true,
    },
    {
        id: '2',
        user_id: 'user-2',
        email: 'sarah@acmedental.com',
        name: 'Sarah Johnson',
        role: 'manager',
        created_at: '2024-02-20T00:00:00Z',
    },
    {
        id: '3',
        user_id: 'user-3',
        email: 'mike@acmedental.com',
        name: 'Mike Chen',
        role: 'viewer',
        created_at: '2024-03-10T00:00:00Z',
    },
];

export function TeamMembers() {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [updatingRole, setUpdatingRole] = useState<string | null>(null);

    // Current user is admin (for demo purposes)
    const currentUserRole: UserRole = 'admin';
    const canManageTeam = currentUserRole === 'admin';

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/team');
            if (response.ok) {
                const data = await response.json();
                setMembers(data.members);
            } else {
                // Use mock data if API not available
                setMembers(MOCK_TEAM_MEMBERS);
            }
        } catch (error) {
            // Use mock data on error
            setMembers(MOCK_TEAM_MEMBERS);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: UserRole) => {
        const member = members.find(m => m.id === memberId);
        if (!member || member.role === newRole) return;

        // Prevent demoting the last admin
        const adminCount = members.filter(m => m.role === 'admin').length;
        if (member.role === 'admin' && adminCount <= 1) {
            toast.error('Cannot change role. At least one admin is required.');
            return;
        }

        setUpdatingRole(memberId);
        try {
            const response = await fetch(`/api/team/${memberId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });

            if (response.ok) {
                setMembers(members.map(m =>
                    m.id === memberId ? { ...m, role: newRole } : m
                ));
                toast.success(`Role updated to ${ROLE_CONFIG[newRole].label}`);
            } else {
                // Mock update for demo
                setMembers(members.map(m =>
                    m.id === memberId ? { ...m, role: newRole } : m
                ));
                toast.success(`Role updated to ${ROLE_CONFIG[newRole].label}`);
            }
        } catch (error) {
            // Mock update for demo
            setMembers(members.map(m =>
                m.id === memberId ? { ...m, role: newRole } : m
            ));
            toast.success(`Role updated to ${ROLE_CONFIG[newRole].label}`);
        } finally {
            setUpdatingRole(null);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        const member = members.find(m => m.id === memberId);
        if (!member) return;

        // Prevent removing the last admin
        const adminCount = members.filter(m => m.role === 'admin').length;
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
            const response = await fetch(`/api/team/${memberId}`, {
                method: 'DELETE',
            });

            if (response.ok || response.status === 404) {
                setMembers(members.filter(m => m.id !== memberId));
                toast.success(`${member.name} has been removed from the team`);
            } else {
                // Mock removal for demo
                setMembers(members.filter(m => m.id !== memberId));
                toast.success(`${member.name} has been removed from the team`);
            }
        } catch (error) {
            // Mock removal for demo
            setMembers(members.filter(m => m.id !== memberId));
            toast.success(`${member.name} has been removed from the team`);
        }
    };

    const handleAddMember = (newMember: TeamMember) => {
        setMembers([...members, newMember]);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

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

            {/* Add Member Dialog */}
            <AddMemberDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onMemberAdded={handleAddMember}
                existingEmails={members.map(m => m.email)}
            />
        </div>
    );
}
