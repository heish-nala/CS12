'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CreateClientDialog } from '@/components/clients/create-client-dialog';
import { CreateCohortDialog } from '@/components/clients/create-cohort-dialog';
import { SearchCommand } from '@/components/layout/search-command';
import { useAuth } from '@/contexts/auth-context';
import { useClients } from '@/contexts/clients-context';
import { useOrg } from '@/contexts/org-context';
import { useOnboarding } from '@/contexts/onboarding-context';
import { Cohort } from '@/lib/db/types';
import {
    Archive,
    Building2,
    ChevronDown,
    ChevronRight,
    Circle,
    Home,
    Loader2,
    LogOut,
    Moon,
    Plus,
    Search,
    Settings,
    Sun,
} from 'lucide-react';

interface SidebarItemProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
}

function SidebarItem({ href, icon, label, isActive }: SidebarItemProps) {
    return (
        <Link href={href}>
            <div
                className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded-lg text-[14px] transition-colors duration-75 cursor-pointer',
                    isActive
                        ? 'bg-accent text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
            >
                <div className="flex items-center justify-center w-5 h-5 shrink-0">
                    {icon}
                </div>
                <span className="flex-1 truncate">{label}</span>
            </div>
        </Link>
    );
}

export function NotionSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const { user, signOut } = useAuth();
    const { clients, archivedClients } = useClients();
    const { org } = useOrg();
    const { isOnboardingActive, currentStep } = useOnboarding();
    const [mounted, setMounted] = useState(false);
    const [createClientOpen, setCreateClientOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set());
    const [cohortsByClientId, setCohortsByClientId] = useState<Record<string, Cohort[]>>({});
    const [loadingClientIds, setLoadingClientIds] = useState<Set<string>>(new Set());
    const [createCohortTarget, setCreateCohortTarget] = useState<{ id: string; name: string } | null>(null);

    const showAddClientButton = isOnboardingActive && currentStep === 'create-client';
    const userEmail = user?.email || '';
    const userInitial = userEmail.charAt(0).toUpperCase() || 'U';

    useEffect(() => setMounted(true), []);

    const fetchCohorts = async (clientId: string, force = false) => {
        if (!force && cohortsByClientId[clientId]) {
            return cohortsByClientId[clientId];
        }

        setLoadingClientIds((current) => {
            const next = new Set(current);
            next.add(clientId);
            return next;
        });

        try {
            const response = await fetch(`/api/cohorts?dso_id=${clientId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch cohorts');
            }

            const nextCohorts = data.cohorts || [];
            setCohortsByClientId((current) => ({
                ...current,
                [clientId]: nextCohorts,
            }));
            return nextCohorts as Cohort[];
        } catch (error) {
            console.error('Error fetching cohorts:', error);
            setCohortsByClientId((current) => ({
                ...current,
                [clientId]: [],
            }));
            return [] as Cohort[];
        } finally {
            setLoadingClientIds((current) => {
                const next = new Set(current);
                next.delete(clientId);
                return next;
            });
        }
    };

    useEffect(() => {
        const cohortPathMatch = pathname.match(/^\/clients\/([^/]+)\/cohorts\/([^/]+)/);
        if (!cohortPathMatch) {
            return;
        }

        const activeClientId = cohortPathMatch[1];
        setExpandedClientIds((current) => {
            if (current.has(activeClientId)) {
                return current;
            }

            const next = new Set(current);
            next.add(activeClientId);
            return next;
        });

        void fetchCohorts(activeClientId);
    }, [pathname]);

    const toggleClientExpansion = async (clientId: string) => {
        const isExpanded = expandedClientIds.has(clientId);

        if (!isExpanded) {
            await fetchCohorts(clientId);
        }

        setExpandedClientIds((current) => {
            const next = new Set(current);
            if (next.has(clientId)) {
                next.delete(clientId);
            } else {
                next.add(clientId);
            }
            return next;
        });
    };

    const handleClientNavigation = async (clientId: string) => {
        const cohorts = await fetchCohorts(clientId);

        if (cohorts.length === 1) {
            router.push(`/clients/${clientId}/cohorts/${cohorts[0].id}`);
            return;
        }

        router.push(`/clients/${clientId}`);
    };

    return (
        <div className="fixed left-0 top-0 w-60 border-r border-border bg-sidebar flex flex-col h-screen" data-onboarding="sidebar">
            <div className="px-2 py-3 border-b border-border">
                <div className="flex items-center gap-2 px-2 py-1">
                    <div className="w-5 h-5 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-semibold">
                        C
                    </div>
                    <span className="font-medium text-[14px] text-foreground truncate">
                        {org?.name ?? 'CS12'}
                    </span>
                </div>
            </div>

            <div className="px-2 py-2">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 h-7 px-2 text-[14px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setSearchOpen(true)}
                >
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded-lg bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        <span className="text-[10px]">⌘</span>K
                    </kbd>
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
                <SidebarItem
                    href="/"
                    icon={<Home className="h-[18px] w-[18px]" />}
                    label="Home"
                    isActive={pathname === '/'}
                />

                <div className="pt-4 pb-1">
                    <div className="flex items-center justify-between px-2 py-1 group">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Clients
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className={cn(
                                'h-5 w-5 p-0 hover:bg-accent rounded-lg transition-opacity duration-100',
                                showAddClientButton ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                            onClick={() => setCreateClientOpen(true)}
                            data-onboarding="add-client-btn"
                        >
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                {clients.map((client) => {
                    const cohorts = cohortsByClientId[client.id] || [];
                    const isLoading = loadingClientIds.has(client.id);
                    const isClientActive = pathname === `/clients/${client.id}` || pathname.startsWith(`/clients/${client.id}/cohorts/`);
                    const isExpanded = expandedClientIds.has(client.id);
                    const showChildren = isExpanded || pathname.startsWith(`/clients/${client.id}/cohorts/`);

                    return (
                        <div key={client.id} className="space-y-0.5">
                            <div
                                className={cn(
                                    'group/client flex items-center gap-1 px-1 py-0.5 rounded-lg text-[14px] transition-colors duration-75',
                                    isClientActive
                                        ? 'bg-accent text-foreground font-medium'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                )}
                            >
                                <button
                                    type="button"
                                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-background/60"
                                    onClick={() => void toggleClientExpansion(client.id)}
                                    aria-label={isExpanded ? `Collapse ${client.name}` : `Expand ${client.name}`}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
                                    onClick={() => void handleClientNavigation(client.id)}
                                >
                                    <div className="flex items-center justify-center w-5 h-5 shrink-0">
                                        <Building2 className="h-[18px] w-[18px]" />
                                    </div>
                                    <span className="flex-1 truncate">{client.name}</span>
                                </button>

                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover/client:opacity-100"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setCreateCohortTarget({ id: client.id, name: client.name });
                                        setExpandedClientIds((current) => {
                                            const next = new Set(current);
                                            next.add(client.id);
                                            return next;
                                        });
                                    }}
                                    title={`Add cohort to ${client.name}`}
                                >
                                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                            </div>

                            {showChildren && (
                                <div className="ml-8 space-y-0.5">
                                    {isLoading ? (
                                        <div className="flex items-center gap-2 px-2 py-1 text-[13px] text-muted-foreground">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            <span>Loading cohorts...</span>
                                        </div>
                                    ) : cohorts.length === 0 ? (
                                        <button
                                            type="button"
                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
                                            onClick={() => setCreateCohortTarget({ id: client.id, name: client.name })}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            <span>Add first cohort</span>
                                        </button>
                                    ) : (
                                        cohorts.map((cohort) => {
                                            const isCohortActive = pathname === `/clients/${client.id}/cohorts/${cohort.id}`;

                                            return (
                                                <Link key={cohort.id} href={`/clients/${client.id}/cohorts/${cohort.id}`}>
                                                    <div
                                                        className={cn(
                                                            'flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] transition-colors duration-75',
                                                            isCohortActive
                                                                ? 'bg-accent text-foreground font-medium'
                                                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                                        )}
                                                    >
                                                        <Circle className="h-2.5 w-2.5 fill-current" />
                                                        <span className="truncate">{cohort.name}</span>
                                                    </div>
                                                </Link>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {archivedClients.length > 0 && (
                    <>
                        <div className="pt-4 pb-1">
                            <button
                                onClick={() => setShowArchived(!showArchived)}
                                className="flex items-center justify-between w-full px-2 py-1 group hover:bg-accent rounded-lg transition-colors duration-75"
                            >
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                    {showArchived ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                    Archived ({archivedClients.length})
                                </span>
                            </button>
                        </div>

                        {showArchived && archivedClients.map((client) => (
                            <SidebarItem
                                key={client.id}
                                href={`/clients/${client.id}`}
                                icon={<Archive className="h-[18px] w-[18px]" />}
                                label={client.name}
                                isActive={pathname === `/clients/${client.id}`}
                            />
                        ))}
                    </>
                )}

                <div className="pt-4 pb-1">
                    <div className="px-2 py-1">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Settings
                        </span>
                    </div>
                </div>

                <SidebarItem
                    href="/settings"
                    icon={<Settings className="h-[18px] w-[18px]" />}
                    label="Settings"
                    isActive={pathname === '/settings'}
                />
            </div>

            {mounted && (
                <div className="px-2 py-2 border-t border-border">
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 h-7 px-2 text-[14px] text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                        {theme === 'dark' ? (
                            <Sun className="h-4 w-4" />
                        ) : (
                            <Moon className="h-4 w-4" />
                        )}
                        <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                    </Button>
                </div>
            )}

            <div className="px-2 py-2 border-t border-border">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors duration-75">
                    <div className="w-5 h-5 rounded-lg bg-[var(--notion-orange)] flex items-center justify-center text-[var(--notion-orange-text)] text-[10px] font-semibold">
                        {userInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-foreground truncate">{userEmail}</div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6 p-0 hover:bg-accent rounded-lg"
                        onClick={() => signOut()}
                        title="Sign out"
                    >
                        <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                </div>
            </div>

            <CreateClientDialog
                open={createClientOpen}
                onOpenChange={setCreateClientOpen}
            />

            <CreateCohortDialog
                open={!!createCohortTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setCreateCohortTarget(null);
                    }
                }}
                dsoId={createCohortTarget?.id || ''}
                clientName={createCohortTarget?.name}
                onCreated={(cohort) => {
                    if (!createCohortTarget) {
                        return;
                    }

                    const clientId = createCohortTarget.id;
                    setCohortsByClientId((current) => ({
                        ...current,
                        [clientId]: [...(current[clientId] || []), cohort],
                    }));
                    setExpandedClientIds((current) => {
                        const next = new Set(current);
                        next.add(clientId);
                        return next;
                    });
                }}
            />

            <SearchCommand
                open={searchOpen}
                onOpenChange={setSearchOpen}
            />
        </div>
    );
}
