'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Client, Cohort } from '@/lib/db/types';
import { ClientSettingsDialog } from '@/components/clients/client-settings-dialog';
import { CreateCohortDialog } from '@/components/clients/create-cohort-dialog';
import {
    Building2,
    CalendarDays,
    ChevronRight,
    Plus,
    Settings,
    Users,
} from 'lucide-react';
import { useClients } from '@/contexts/clients-context';

interface ClientDetailPageProps {
    params: Promise<{ id: string }>;
}

function formatDate(date: string | null) {
    if (!date) {
        return 'No start date';
    }

    return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function getStatusClasses(status: Cohort['status']) {
    switch (status) {
        case 'completed':
            return 'border-green-200 bg-green-50 text-green-700';
        case 'archived':
            return 'border-slate-200 bg-slate-100 text-slate-700';
        default:
            return 'border-blue-200 bg-blue-50 text-blue-700';
    }
}

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
    const { id } = use(params);
    const { clients, archivedClients, loading: clientsLoading, refreshClients } = useClients();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [createCohortOpen, setCreateCohortOpen] = useState(false);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [cohortsLoading, setCohortsLoading] = useState(true);

    const client = useMemo(() => {
        const allClients = [...clients, ...archivedClients];
        return allClients.find((candidate) => candidate.id === id) as Client | undefined;
    }, [archivedClients, clients, id]);

    useEffect(() => {
        let cancelled = false;

        async function fetchCohorts() {
            setCohortsLoading(true);

            try {
                const response = await fetch(`/api/cohorts?dso_id=${id}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch cohorts');
                }

                if (!cancelled) {
                    setCohorts(data.cohorts || []);
                }
            } catch (error) {
                console.error('Error fetching cohorts:', error);
                if (!cancelled) {
                    setCohorts([]);
                }
            } finally {
                if (!cancelled) {
                    setCohortsLoading(false);
                }
            }
        }

        fetchCohorts();

        return () => {
            cancelled = true;
        };
    }, [id]);

    if (clientsLoading) {
        return (
            <div className="flex-1 bg-background min-h-screen">
                <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                    <div className="px-6 lg:px-8 pt-8 pb-6">
                        <div className="max-w-6xl mx-auto">
                            <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
                            <div className="h-7 w-48 bg-muted animate-pulse rounded" />
                        </div>
                    </div>
                </div>
                <div className="px-6 lg:px-8 py-6">
                    <div className="max-w-6xl mx-auto grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="h-48 rounded-2xl border border-border/50 bg-muted/20 animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex-1 bg-background min-h-screen">
                <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                    <div className="px-6 lg:px-8 pt-8 pb-6">
                        <div className="max-w-6xl mx-auto">
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                Client not found
                            </h1>
                        </div>
                    </div>
                </div>
                <div className="px-6 lg:px-8 py-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-muted/20 to-muted/5 p-16 text-center">
                            <div className="p-4 rounded-2xl bg-muted/50 inline-block mb-4">
                                <Building2 className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h2 className="text-lg font-semibold text-foreground mb-2">Client not found</h2>
                            <p className="text-sm text-muted-foreground">
                                The client you&apos;re looking for doesn&apos;t exist or has been removed.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-background min-h-screen content-loaded">
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                <div className="px-6 lg:px-8 pt-8 pb-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Building2 className="w-4 h-4" />
                                    <span>Client</span>
                                    <span className="text-border">•</span>
                                    <span>Cohorts</span>
                                </div>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                    {client.name}
                                </h1>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Organize attendee data, activity, and progress by cohort.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSettingsOpen(true)}
                                    className="shadow-sm"
                                >
                                    <Settings className="h-4 w-4 mr-1.5" />
                                    Settings
                                </Button>
                                <Button size="sm" onClick={() => setCreateCohortOpen(true)} className="shadow-sm">
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Add Cohort
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 lg:px-8 py-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Cohorts</h2>
                        <p className="text-sm text-muted-foreground">
                            Choose a cohort to open its attendees, overview, activity, and progress tabs.
                        </p>
                    </div>

                    {cohortsLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="h-48 rounded-2xl border border-border/50 bg-muted/20 animate-pulse" />
                            ))}
                        </div>
                    ) : cohorts.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-muted/20 to-muted/5 p-16 text-center">
                            <div className="p-4 rounded-2xl bg-muted/50 inline-block mb-4">
                                <Users className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h2 className="text-lg font-semibold text-foreground mb-2">No cohorts yet</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                                Add the first cohort for this client to start grouping attendee data.
                            </p>
                            <Button onClick={() => setCreateCohortOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Cohort
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {cohorts.map((cohort) => (
                                <Link
                                    key={cohort.id}
                                    href={`/clients/${id}/cohorts/${cohort.id}`}
                                    className="group"
                                >
                                    <div className="h-full rounded-2xl border border-border/60 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-lg font-semibold text-foreground">
                                                    {cohort.name}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                                    <CalendarDays className="h-4 w-4" />
                                                    <span>{formatDate(cohort.start_date)}</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                        </div>

                                        <div className="mt-6 flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-2xl font-semibold text-foreground">
                                                    {cohort.attendee_count || 0}
                                                </div>
                                                <div className="text-sm text-muted-foreground">Attendees</div>
                                            </div>
                                            <Badge variant="outline" className={getStatusClasses(cohort.status)}>
                                                {cohort.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ClientSettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                client={client}
                onUpdate={refreshClients}
            />

            <CreateCohortDialog
                open={createCohortOpen}
                onOpenChange={setCreateCohortOpen}
                dsoId={id}
                clientName={client.name}
                onCreated={(cohort) => {
                    setCohorts((current) => [...current, cohort]);
                }}
            />
        </div>
    );
}
