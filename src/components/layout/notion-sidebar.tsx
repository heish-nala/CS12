'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CreateClientDialog } from '@/components/clients/create-client-dialog';
import { SearchCommand } from '@/components/layout/search-command';
import { useAuth } from '@/contexts/auth-context';
import { useClients } from '@/contexts/clients-context';
import { useOnboarding } from '@/contexts/onboarding-context';
import {
    Home,
    Users,
    Settings,
    Plus,
    Search,
    LogOut,
    Building2,
    Archive,
    ChevronDown,
    ChevronRight,
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
    const { user, signOut } = useAuth();
    const { clients, archivedClients } = useClients();
    const { isOnboardingActive, currentStep } = useOnboarding();
    const [createClientOpen, setCreateClientOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    // Show add-client button during onboarding create-client step
    const showAddClientButton = isOnboardingActive && currentStep === 'create-client';

    const userEmail = user?.email || '';
    const userInitial = userEmail.charAt(0).toUpperCase() || 'U';

    return (
        <div className="fixed left-0 top-0 w-60 border-r border-border bg-sidebar flex flex-col h-screen" data-onboarding="sidebar">
            {/* Header - Logo */}
            <div className="px-2 py-3 border-b border-border">
                <div className="flex items-center gap-2 px-2 py-1">
                    <div className="w-5 h-5 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-semibold">
                        C
                    </div>
                    <span className="font-medium text-[14px] text-foreground">CS12</span>
                </div>
            </div>

            {/* Search */}
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

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
                <SidebarItem
                    href="/"
                    icon={<Home className="h-[18px] w-[18px]" />}
                    label="Home"
                    isActive={pathname === '/'}
                />

                {/* Clients Section */}
                <div className="pt-4 pb-1">
                    <div className="flex items-center justify-between px-2 py-1 group">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Clients
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className={cn(
                                "h-5 w-5 p-0 hover:bg-accent rounded-lg transition-opacity duration-100",
                                showAddClientButton ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                            onClick={() => setCreateClientOpen(true)}
                            data-onboarding="add-client-btn"
                        >
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                {clients.map((client) => (
                    <SidebarItem
                        key={client.id}
                        href={`/clients/${client.id}`}
                        icon={<Building2 className="h-[18px] w-[18px]" />}
                        label={client.name}
                        isActive={pathname === `/clients/${client.id}`}
                    />
                ))}

                {/* Archived Section */}
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

                {/* Settings Section */}
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

            {/* Footer - User Profile */}
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

            {/* Create Client Dialog */}
            <CreateClientDialog
                open={createClientOpen}
                onOpenChange={setCreateClientOpen}
            />

            {/* Search Command */}
            <SearchCommand
                open={searchOpen}
                onOpenChange={setSearchOpen}
            />
        </div>
    );
}
