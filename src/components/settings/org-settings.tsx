'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Crown, User, Building2, Pencil } from 'lucide-react';
import { useOrg } from '@/contexts/org-context';
import { useAuth } from '@/contexts/auth-context';
import { OrgMemberWithProfile } from '@/lib/db/types';
import { DsoAssignmentDialog } from './dso-assignment-dialog';
import { toast } from 'sonner';

interface DsoAccessRow {
    user_id: string;
    dso_id: string;
    role: string;
}

interface DsoInfo {
    id: string;
    name: string;
}

const ORG_ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    owner: {
        label: 'Owner',
        icon: <Crown className="h-3.5 w-3.5" />,
        color: 'bg-[var(--notion-yellow)] text-[var(--notion-yellow-text)]',
    },
    admin: {
        label: 'Admin',
        icon: <Shield className="h-3.5 w-3.5" />,
        color: 'bg-[var(--notion-purple)] text-[var(--notion-purple-text)]',
    },
    member: {
        label: 'Member',
        icon: <User className="h-3.5 w-3.5" />,
        color: 'bg-[var(--notion-gray)] text-[var(--notion-gray-text)]',
    },
};

export function OrgSettings() {
    const { org } = useOrg();
    const { user } = useAuth();
    const [members, setMembers] = useState<OrgMemberWithProfile[]>([]);
    const [dsoAccess, setDsoAccess] = useState<DsoAccessRow[]>([]);
    const [allDsos, setAllDsos] = useState<DsoInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState<OrgMemberWithProfile | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const canManage = org?.role === 'owner' || org?.role === 'admin';

    const fetchData = useCallback(async () => {
        if (!org?.id) return;

        setLoading(true);
        try {
            if (canManage) {
                // Admin/owner: fetch all three endpoints in parallel
                const [membersRes, accessRes, dsosRes] = await Promise.all([
                    fetch(`/api/orgs/${org.id}/members`),
                    fetch(`/api/orgs/${org.id}/dso-access`),
                    fetch(`/api/orgs/${org.id}/dsos`),
                ]);

                if (membersRes.ok) {
                    const data = await membersRes.json();
                    setMembers(data.members || []);
                } else {
                    toast.error('Failed to load members');
                }

                if (accessRes.ok) {
                    const data = await accessRes.json();
                    setDsoAccess(data.access || []);
                } else {
                    // Non-admin might land here on a role change — silently clear
                    setDsoAccess([]);
                }

                if (dsosRes.ok) {
                    const data = await dsosRes.json();
                    setAllDsos(data.dsos || []);
                }
            } else {
                // Member: only fetch member list (DSO info comes from ClientsContext)
                const membersRes = await fetch(`/api/orgs/${org.id}/members`);
                if (membersRes.ok) {
                    const data = await membersRes.json();
                    setMembers(data.members || []);
                } else {
                    toast.error('Failed to load members');
                }
                setDsoAccess([]);
                setAllDsos([]);
            }
        } catch (error) {
            console.error('Error loading org settings data:', error);
            toast.error('Failed to load organization data');
        } finally {
            setLoading(false);
        }
    }, [org?.id, canManage]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Build user_id → dso_id[] lookup for admin view
    const accessByUser = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const row of dsoAccess) {
            const existing = map.get(row.user_id) ?? [];
            existing.push(row.dso_id);
            map.set(row.user_id, existing);
        }
        return map;
    }, [dsoAccess]);

    // Build dso_id → dso name lookup
    const dsoNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const dso of allDsos) {
            map.set(dso.id, dso.name);
        }
        return map;
    }, [allDsos]);

    const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
        const source = name || email || '?';
        return source
            .split(/[ @]/)
            .filter(Boolean)
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getMemberDisplayName = (member: OrgMemberWithProfile) => {
        return member.user_profiles?.name || member.user_profiles?.email?.split('@')[0] || 'Unknown';
    };

    const handleEditDsos = (member: OrgMemberWithProfile) => {
        setSelectedMember(member);
        setDialogOpen(true);
    };

    const handleDialogSave = () => {
        setDialogOpen(false);
        fetchData();
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-24 bg-muted/50 rounded-xl animate-pulse" />
                <div className="h-10 bg-muted/50 rounded-xl animate-pulse" />
                <div className="h-16 bg-muted/50 rounded animate-pulse" />
                <div className="h-16 bg-muted/50 rounded animate-pulse" />
                <div className="h-16 bg-muted/50 rounded animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Org name header */}
            <div className="rounded-xl border border-border/50 p-6 bg-card shadow-sm">
                <h3 className="font-semibold text-foreground mb-1">Organization</h3>
                <p className="text-lg text-foreground">{org?.name ?? '—'}</p>
            </div>

            {/* Members section */}
            <div className="rounded-xl border border-border/50 bg-card shadow-sm">
                <div className="p-4 border-b border-border/50">
                    <h3 className="font-semibold text-foreground">Members</h3>
                    <p className="text-sm text-muted-foreground">
                        {members.length} member{members.length !== 1 ? 's' : ''} in this organization
                    </p>
                </div>
                <div className="divide-y divide-border/50">
                    {members.map((member) => {
                        const roleConfig = ORG_ROLE_CONFIG[member.role] ?? ORG_ROLE_CONFIG.member;
                        const isCurrentUser = member.user_id === user?.id;
                        const memberDsoIds = canManage ? (accessByUser.get(member.user_id) ?? []) : [];
                        const memberDsoNames = memberDsoIds.map(
                            (dsoId) => dsoNameMap.get(dsoId) ?? dsoId
                        );

                        return (
                            <div
                                key={member.id}
                                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                            >
                                {/* Member info */}
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
                                        {getInitials(
                                            member.user_profiles?.name,
                                            member.user_profiles?.email
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-foreground">
                                                {getMemberDisplayName(member)}
                                            </span>
                                            {isCurrentUser && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] px-1.5 py-0"
                                                >
                                                    You
                                                </Badge>
                                            )}
                                            <Badge
                                                variant="outline"
                                                className={`${roleConfig.color} gap-1`}
                                            >
                                                {roleConfig.icon}
                                                {roleConfig.label}
                                            </Badge>
                                        </div>
                                        {member.user_profiles?.email && (
                                            <p className="text-sm text-muted-foreground truncate">
                                                {member.user_profiles.email}
                                            </p>
                                        )}
                                        {/* DSO assignment badges */}
                                        {canManage && memberDsoNames.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {memberDsoNames.map((name) => (
                                                    <Badge
                                                        key={name}
                                                        variant="outline"
                                                        className="text-[10px] px-1.5 py-0 gap-0.5 text-muted-foreground"
                                                    >
                                                        <Building2 className="h-2.5 w-2.5" />
                                                        {name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                        {canManage && memberDsoNames.length === 0 && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                No DSO access assigned
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Edit DSOs button (admin only) */}
                                {canManage && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0 ml-3 text-muted-foreground hover:text-foreground"
                                        onClick={() => handleEditDsos(member)}
                                    >
                                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                        Edit DSOs
                                    </Button>
                                )}
                            </div>
                        );
                    })}

                    {members.length === 0 && (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No members found
                        </div>
                    )}
                </div>
            </div>

            {/* DSO assignment dialog */}
            <DsoAssignmentDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                member={selectedMember}
                orgId={org?.id ?? ''}
                allDsos={allDsos}
                currentAssignments={
                    selectedMember ? (accessByUser.get(selectedMember.user_id) ?? []) : []
                }
                onSave={handleDialogSave}
            />
        </div>
    );
}
