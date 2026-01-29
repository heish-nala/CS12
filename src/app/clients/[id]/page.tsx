'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { Client } from '@/lib/db/types';
import { ExecutiveDashboard } from '@/components/dashboard/executive-dashboard';
import { DataTablesView } from '@/components/data-tables/data-tables-view';
import { ClientSettingsDialog } from '@/components/clients/client-settings-dialog';
import { MetricConfigDialog } from '@/components/metrics/metric-config-dialog';
import { MetricConfigProvider, useMetricConfig } from '@/contexts/metric-config-context';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import { ProgressTab } from '@/components/clients/progress-tab';
import { Button } from '@/components/ui/button';
import { Settings, Building2, Mail, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClients } from '@/contexts/clients-context';

interface ClientDetailPageProps {
    params: Promise<{ id: string }>;
}

export default function ClientDetailPage({ params }: ClientDetailPageProps) {
    const { id } = use(params);
    const { clients, archivedClients, loading: clientsLoading, refreshClients } = useClients();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);

    // Find client in the context (includes both active and archived)
    const client = useMemo(() => {
        const allClients = [...clients, ...archivedClients];
        return allClients.find((c) => c.id === id) as Client | undefined;
    }, [clients, archivedClients, id]);

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
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Tabs skeleton */}
                        <div className="flex gap-2">
                            <div className="h-9 w-24 bg-muted/40 animate-pulse rounded-lg" />
                            <div className="h-9 w-24 bg-muted/30 animate-pulse rounded-lg" />
                            <div className="h-9 w-20 bg-muted/30 animate-pulse rounded-lg" />
                        </div>
                        {/* Table skeleton */}
                        <div className="rounded-xl border border-border/50 overflow-hidden">
                            <div className="h-12 bg-muted/30 border-b border-border/50" />
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-12 border-b border-border/50 flex items-center gap-4 px-4" style={{ opacity: 1 - i * 0.15 }}>
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
                                The client you're looking for doesn't exist or has been removed.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <MetricConfigProvider clientId={id}>
            <ClientDetailContent
                client={client}
                clientId={id}
                settingsOpen={settingsOpen}
                setSettingsOpen={setSettingsOpen}
                metricsDialogOpen={metricsDialogOpen}
                setMetricsDialogOpen={setMetricsDialogOpen}
                refreshClients={refreshClients}
            />
        </MetricConfigProvider>
    );
}

function ClientDetailContent({
    client,
    clientId,
    settingsOpen,
    setSettingsOpen,
    metricsDialogOpen,
    setMetricsDialogOpen,
    refreshClients,
}: {
    client: Client;
    clientId: string;
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
            {/* Modern Header */}
            <div className="border-b border-border/50 bg-gradient-to-b from-muted/30 to-background">
                <div className="px-6 lg:px-8 pt-8 pb-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Building2 className="w-4 h-4" />
                                    <span>Client</span>
                                    {client.industry && (
                                        <>
                                            <span className="text-border">•</span>
                                            <span>{client.industry}</span>
                                        </>
                                    )}
                                </div>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                    {client.name}
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

                        {/* Contact Info */}
                        {client.contact_name && (
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                                <div className="flex items-center gap-2 text-sm">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Contact:</span>
                                    <span className="font-medium">{client.contact_name}</span>
                                </div>
                                {client.contact_email && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">{client.contact_email}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 lg:px-8 py-6">
                <div className="max-w-6xl mx-auto">
                    {/* Tabs - unchanged content */}
                    <Tabs defaultValue="attendees" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="attendees" data-onboarding="data-tables-tab">Attendees</TabsTrigger>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="activity">Activity</TabsTrigger>
                            <TabsTrigger value="progress">Progress</TabsTrigger>
                        </TabsList>

                        <TabsContent value="attendees" className="space-y-6 mt-0">
                            <DataTablesView clientId={clientId} />
                        </TabsContent>

                        <TabsContent value="overview" className="space-y-6 mt-0">
                            <ExecutiveDashboard dsoId={clientId} />
                        </TabsContent>

                        <TabsContent value="activity" className="space-y-6 mt-0">
                            <ActivityTimeline clientId={clientId} clientName={client.name} />
                        </TabsContent>

                        <TabsContent value="progress" className="space-y-6 mt-0">
                            <ProgressTab clientId={clientId} clientName={client.name} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Client Settings Dialog */}
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

            {/* Metric Configuration Dialog */}
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
