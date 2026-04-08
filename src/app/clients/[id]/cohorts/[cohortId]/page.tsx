'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Client, Cohort } from '@/lib/db/types';
import { OverviewDashboard } from '@/components/dashboard/overview-dashboard';
import { DataTablesView } from '@/components/data-tables/data-tables-view';
import { ClientSettingsDialog } from '@/components/clients/client-settings-dialog';
import { MetricConfigDialog } from '@/components/metrics/metric-config-dialog';
import { MetricConfigProvider, useMetricConfig } from '@/contexts/metric-config-context';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import { ProgressTab } from '@/components/clients/progress-tab';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClients } from '@/contexts/clients-context';
import { Building2, ChevronRight, Settings } from 'lucide-react';

interface CohortDetailPageProps {
    params: Promise<{ id: string; cohortId: string }>;
}

export default function CohortDetailPage({ params }: CohortDetailPageProps) {
    const { id, cohortId } = use(params);
    const { clients, archivedClients, loading: clientsLoading, refreshClients } = useClients();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
    const [cohort, setCohort] = useState<Cohort | null>(null);
    const [cohortLoading, setCohortLoading] = useState(true);

    const client = useMemo(() => {
        const allClients = [...clients, ...archivedClients];
        return allClients.find((candidate) => candidate.id === id) as Client | undefined;
    }, [archivedClients, clients, id]);

    useEffect(() => {
        let cancelled = false;

        async function fetchCohort() {
            setCohortLoading(true);

            try {
                const response = await fetch(`/api/cohorts?dso_id=${id}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch cohorts');
                }

                if (!cancelled) {
                    const matchedCohort = (data.cohorts || []).find((candidate: Cohort) => candidate.id === cohortId) || null;
                    setCohort(matchedCohort);
                }
            } catch (error) {
                console.error('Error fetching cohort:', error);
                if (!cancelled) {
                    setCohort(null);
                }
            } finally {
                if (!cancelled) {
                    setCohortLoading(false);
                }
            }
        }

        fetchCohort();

        return () => {
            cancelled = true;
        };
    }, [cohortId, id]);

    if (clientsLoading || cohortLoading) {
        return (
            <div className="flex-1 bg-background min-h-screen">
                <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                    <div className="px-6 lg:px-8 pt-8 pb-6">
                        <div className="max-w-6xl mx-auto">
                            <div className="h-4 w-40 bg-muted animate-pulse rounded mb-2" />
                            <div className="h-7 w-56 bg-muted animate-pulse rounded" />
                        </div>
                    </div>
                </div>
                <div className="px-6 lg:px-8 py-6">
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="flex gap-2">
                            <div className="h-9 w-24 bg-muted/40 animate-pulse rounded-lg" />
                            <div className="h-9 w-24 bg-muted/30 animate-pulse rounded-lg" />
                            <div className="h-9 w-20 bg-muted/30 animate-pulse rounded-lg" />
                        </div>
                        <div className="rounded-xl border border-border/50 overflow-hidden">
                            <div className="h-12 bg-muted/30 border-b border-border/50" />
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div key={index} className="h-12 border-b border-border/50 flex items-center gap-4 px-4" style={{ opacity: 1 - index * 0.15 }}>
                                    <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                                    <div className="h-4 flex-1 max-w-[150px] bg-muted animate-pulse rounded" />
                                    <div className="h-4 flex-1 max-w-[100px] bg-muted/60 animate-pulse rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!client || !cohort) {
        return (
            <div className="flex-1 bg-background min-h-screen">
                <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                    <div className="px-6 lg:px-8 pt-8 pb-6">
                        <div className="max-w-6xl mx-auto">
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                Cohort not found
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
                            <h2 className="text-lg font-semibold text-foreground mb-2">Cohort not found</h2>
                            <p className="text-sm text-muted-foreground">
                                The cohort you&apos;re looking for doesn&apos;t exist or is no longer available.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <MetricConfigProvider clientId={id}>
            <CohortDetailContent
                client={client}
                cohort={cohort}
                clientId={id}
                cohortId={cohortId}
                settingsOpen={settingsOpen}
                setSettingsOpen={setSettingsOpen}
                metricsDialogOpen={metricsDialogOpen}
                setMetricsDialogOpen={setMetricsDialogOpen}
                refreshClients={refreshClients}
            />
        </MetricConfigProvider>
    );
}

function CohortDetailContent({
    client,
    cohort,
    clientId,
    cohortId,
    settingsOpen,
    setSettingsOpen,
    metricsDialogOpen,
    setMetricsDialogOpen,
    refreshClients,
}: {
    client: Client;
    cohort: Cohort;
    clientId: string;
    cohortId: string;
    settingsOpen: boolean;
    setSettingsOpen: (open: boolean) => void;
    metricsDialogOpen: boolean;
    setMetricsDialogOpen: (open: boolean) => void;
    refreshClients: () => Promise<void>;
}) {
    const { metricConfigs, refresh } = useMetricConfig();

    const handleSaveMetricConfig = async (configs: any[]) => {
        const response = await fetch('/api/metrics/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                configs,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to save metric configuration');
        }

        await refresh();
    };

    return (
        <div className="flex-1 bg-background min-h-screen content-loaded" data-onboarding="client-dashboard">
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                <div className="px-6 lg:px-8 pt-8 pb-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                    <Link href={`/clients/${clientId}`} className="hover:text-foreground transition-colors">
                                        {client.name}
                                    </Link>
                                    <ChevronRight className="h-4 w-4" />
                                    <span className="text-foreground">{cohort.name}</span>
                                </div>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                    {cohort.name}
                                </h1>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSettingsOpen(true)}
                                className="shadow-sm"
                            >
                                <Settings className="h-4 w-4 mr-1.5" />
                                Settings
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 lg:px-8 py-6">
                <div className="max-w-6xl mx-auto">
                    <Tabs defaultValue="attendees" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="attendees" data-onboarding="data-tables-tab">Attendees</TabsTrigger>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="activity">Activity</TabsTrigger>
                            <TabsTrigger value="progress">Progress</TabsTrigger>
                        </TabsList>

                        <TabsContent value="attendees" className="space-y-6 mt-0">
                            <DataTablesView clientId={clientId} cohortId={cohortId} />
                        </TabsContent>

                        <TabsContent value="overview" className="space-y-6 mt-0">
                            <OverviewDashboard dsoId={clientId} cohortId={cohortId} />
                        </TabsContent>

                        <TabsContent value="activity" className="space-y-6 mt-0">
                            <ActivityTimeline clientId={clientId} clientName={client.name} cohortId={cohortId} />
                        </TabsContent>

                        <TabsContent value="progress" className="space-y-6 mt-0">
                            <ProgressTab clientId={clientId} clientName={client.name} cohortId={cohortId} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <ClientSettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                client={client}
                onUpdate={refreshClients}
                onOpenMetricsDialog={() => {
                    setSettingsOpen(false);
                    setTimeout(() => {
                        setMetricsDialogOpen(true);
                    }, 100);
                }}
            />

            <MetricConfigDialog
                open={metricsDialogOpen}
                onOpenChange={setMetricsDialogOpen}
                clientId={clientId}
                currentConfig={metricConfigs}
                onSave={handleSaveMetricConfig}
            />
        </div>
    );
}
