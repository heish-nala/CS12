'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { Home, Users, Settings, Building2, User, Table2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface SearchResult {
    id: string;
    type: 'client' | 'doctor' | 'row';
    title: string;
    subtitle?: string;
    href: string;
}

interface SearchCommandProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    // Debounced search
    useEffect(() => {
        if (!query || query.length < 2) {
            setResults([]);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(async () => {
            setLoading(true);
            try {
                const userIdParam = user?.id ? `&user_id=${user.id}` : '';
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}${userIdParam}`, {
                    signal: controller.signal,
                });
                const data = await response.json();
                setResults(data.results || []);
            } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Search error:', error);
                }
            } finally {
                setLoading(false);
            }
        }, 200);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [query]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onOpenChange(!open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [open, onOpenChange]);

    // Reset query when dialog closes
    useEffect(() => {
        if (!open) {
            setQuery('');
            setResults([]);
        }
    }, [open]);

    const runCommand = useCallback((command: () => void) => {
        onOpenChange(false);
        command();
    }, [onOpenChange]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'client':
                return <Building2 className="h-4 w-4" />;
            case 'doctor':
                return <User className="h-4 w-4" />;
            case 'row':
                return <Table2 className="h-4 w-4" />;
            default:
                return null;
        }
    };

    const clientResults = results.filter(r => r.type === 'client');
    const doctorResults = results.filter(r => r.type === 'doctor');
    const rowResults = results.filter(r => r.type === 'row');
    const hasResults = results.length > 0;

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput
                placeholder="Search everything..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                {loading && (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loading && !hasResults && query.length >= 2 && (
                    <CommandEmpty>No results found.</CommandEmpty>
                )}

                {!loading && !query && (
                    <CommandGroup heading="Quick Links">
                        <CommandItem
                            onSelect={() => runCommand(() => router.push('/'))}
                        >
                            <Home className="mr-2 h-4 w-4" />
                            <span>Home</span>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push('/clients/1'))}
                        >
                            <Users className="mr-2 h-4 w-4" />
                            <span>Clients</span>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => runCommand(() => router.push('/settings'))}
                        >
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                        </CommandItem>
                    </CommandGroup>
                )}

                {!loading && clientResults.length > 0 && (
                    <>
                        <CommandGroup heading="Clients">
                            {clientResults.map((result) => (
                                <CommandItem
                                    key={`client-${result.id}`}
                                    value={`client-${result.title}`}
                                    onSelect={() => runCommand(() => router.push(result.href))}
                                >
                                    {getIcon(result.type)}
                                    <span className="ml-2">{result.title}</span>
                                    {result.subtitle && (
                                        <span className="ml-2 text-[12px] text-muted-foreground">
                                            {result.subtitle}
                                        </span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}

                {!loading && doctorResults.length > 0 && (
                    <>
                        {clientResults.length > 0 && <CommandSeparator />}
                        <CommandGroup heading="Doctors">
                            {doctorResults.map((result) => (
                                <CommandItem
                                    key={`doctor-${result.id}`}
                                    value={`doctor-${result.title}`}
                                    onSelect={() => runCommand(() => router.push(result.href))}
                                >
                                    {getIcon(result.type)}
                                    <span className="ml-2">{result.title}</span>
                                    {result.subtitle && (
                                        <span className="ml-2 text-[12px] text-muted-foreground">
                                            {result.subtitle}
                                        </span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}

                {!loading && rowResults.length > 0 && (
                    <>
                        {(clientResults.length > 0 || doctorResults.length > 0) && <CommandSeparator />}
                        <CommandGroup heading="Data">
                            {rowResults.map((result) => (
                                <CommandItem
                                    key={`row-${result.id}`}
                                    value={`row-${result.title}-${result.id}`}
                                    onSelect={() => runCommand(() => router.push(result.href))}
                                >
                                    {getIcon(result.type)}
                                    <span className="ml-2">{result.title}</span>
                                    {result.subtitle && (
                                        <span className="ml-2 text-[12px] text-muted-foreground">
                                            {result.subtitle}
                                        </span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
}
