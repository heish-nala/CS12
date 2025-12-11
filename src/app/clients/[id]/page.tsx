'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { Client } from '@/lib/db/types';
import { ExecutiveDashboard } from '@/components/dashboard/executive-dashboard';
import { DataTablesView } from '@/components/data-tables/data-tables-view';
import { ClientSettingsDialog } from '@/components/clients/client-settings-dialog';
import { MetricConfigDialog } from '@/components/metrics/metric-config-dialog';
import { MetricConfigProvider, useMetricConfig } from '@/contexts/metric-config-context';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
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
                <div className="px-24 pt-20 pb-4">
                    <div className="max-w-5xl mx-auto">
                        <div className="h-10 w-64 bg-muted animate-pulse rounded-[3px] mb-2" />
                        <div className="h-4 w-32 bg-muted/60 animate-pulse rounded-[3px]" />
                    </div>
                </div>
                <div className="px-24 pb-24">
                    <div className="max-w-5xl mx-auto">
                        <div className="h-96 bg-muted/40 animate-pulse rounded-[3px]" />
                    </div>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex-1 bg-background min-h-screen">
                <div className="px-24 pt-20">
                    <div className="max-w-5xl mx-auto text-center py-16">
                        <h2 className="text-[24px] font-semibold text-foreground mb-2">Client not found</h2>
                        <p className="text-[14px] text-muted-foreground">
                            The client you're looking for doesn't exist. Click "Clients" in the navigation to view all clients.
                        </p>
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
        <div className="flex-1 bg-background min-h-screen" data-onboarding="client-dashboard">
            {/* Notion-style Page Header */}
            <div className="px-24 pt-20 pb-4">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-[40px] font-bold tracking-tight text-foreground leading-[1.2] mb-2">
                        {client.name}
                    </h1>
                    {client.industry && (
                        <p className="text-[14px] text-muted-foreground">{client.industry}</p>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="px-24 pb-24">
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Settings Button - Floating */}
                    <div className="fixed top-6 right-6 z-10">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSettingsOpen(true)}
                        >
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                        </Button>
                    </div>

                    {/* Contact Info Banner */}
                    {client.contact_name && (
                        <div className="bg-muted/50 rounded-[3px] p-4 border border-border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Primary Contact</p>
                                    <p className="text-[14px] font-medium text-foreground">{client.contact_name}</p>
                                </div>
                                {client.contact_email && (
                                    <div className="text-right">
                                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Email</p>
                                        <p className="text-[14px] font-medium text-foreground">{client.contact_email}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <Tabs defaultValue="data" className="space-y-6">
                        <TabsList>
                            <TabsTrigger value="data" data-onboarding="data-tables-tab">Data</TabsTrigger>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="activity">Activity</TabsTrigger>
                        </TabsList>

                        <TabsContent value="data" className="space-y-6 mt-0">
                            <DataTablesView clientId={clientId} />
                        </TabsContent>

                        <TabsContent value="overview" className="space-y-6 mt-0">
                            <ExecutiveDashboard dsoId={clientId} />
                        </TabsContent>

                        <TabsContent value="activity" className="space-y-6 mt-0">
                            <ActivityTimeline clientId={clientId} />
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
