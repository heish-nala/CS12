'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/db/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, AlertTriangle, ArrowRight, Plus, Settings2, BarChart3, FolderOpen } from 'lucide-react';
import { CardConfigDialog, MetricConfig, DEFAULT_METRICS } from './card-config-dialog';
import { CreateClientDialog } from './create-client-dialog';
import { useAuth } from '@/contexts/auth-context';

interface ClientMetrics {
    client_id: string;
    total_doctors: number;
    active_doctors: number;
    at_risk_count: number;
    engagement_rate: number;
    total_cases: number;
    total_courses: number;
    avg_course_progress: number;
}

interface ClientWithMetrics extends Client {
    metrics: ClientMetrics;
}

export function ClientsOverview() {
    const router = useRouter();
    const { user } = useAuth();
    const [clients, setClients] = useState<ClientWithMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [createClientOpen, setCreateClientOpen] = useState(false);
    const [metrics, setMetrics] = useState<MetricConfig[]>(DEFAULT_METRICS);

    useEffect(() => {
        if (user?.id) {
            fetchClients();
        }
        loadMetricsConfig();
    }, [user?.id]);

    const loadMetricsConfig = () => {
        try {
            const stored = localStorage.getItem('client_card_metrics');
            if (stored) {
                setMetrics(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading metrics config:', error);
        }
    };

    const saveMetricsConfig = (newMetrics: MetricConfig[]) => {
        try {
            localStorage.setItem('client_card_metrics', JSON.stringify(newMetrics));
            setMetrics(newMetrics);
        } catch (error) {
            console.error('Error saving metrics config:', error);
        }
    };

    const renderMetric = (metricId: string, client: ClientWithMetrics) => {
        switch (metricId) {
            case 'total_doctors':
                return (
                    <div key={metricId}>
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            Doctors
                        </div>
                        <div className="text-[20px] font-semibold text-foreground">
                            {client.metrics.total_doctors}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            {client.metrics.active_doctors} active
                        </div>
                    </div>
                );
            case 'active_doctors':
                return (
                    <div key={metricId}>
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            Active
                        </div>
                        <div className="text-[20px] font-semibold text-foreground">
                            {client.metrics.active_doctors}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            of {client.metrics.total_doctors} total
                        </div>
                    </div>
                );
            case 'engagement_rate':
                return (
                    <div key={metricId}>
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
                            <TrendingUp className="h-3 w-3" />
                            Engagement
                        </div>
                        <div className="text-[20px] font-semibold text-foreground">
                            {client.metrics.engagement_rate}%
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            Last 7 days
                        </div>
                    </div>
                );
            case 'at_risk_count':
                return client.metrics.at_risk_count > 0 ? (
                    <div key={metricId}>
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
                            <AlertTriangle className="h-3 w-3" />
                            At Risk
                        </div>
                        <div className="text-[20px] font-semibold text-[var(--notion-orange-text)]">
                            {client.metrics.at_risk_count}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            Need attention
                        </div>
                    </div>
                ) : null;
            case 'total_cases':
                return (
                    <div key={metricId}>
                        <div className="text-[12px] text-muted-foreground mb-1">
                            Total Cases
                        </div>
                        <div className="text-[20px] font-semibold text-foreground">
                            {client.metrics.total_cases}
                        </div>
                    </div>
                );
            case 'avg_course_progress':
                return (
                    <div key={metricId}>
                        <div className="text-[12px] text-muted-foreground mb-1">
                            Avg Progress
                        </div>
                        <div className="text-[20px] font-semibold text-foreground">
                            {client.metrics.avg_course_progress}%
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const fetchClients = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        try {
            const response = await fetch(`/api/clients/overview?user_id=${user.id}`);
            const data = await response.json();
            setClients(data.clients || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i} className="h-56">
                        <CardHeader>
                            <div className="h-5 w-32 bg-muted animate-pulse rounded-[3px]" />
                            <div className="h-3 w-24 bg-muted/60 animate-pulse rounded-[3px]" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="h-3 w-full bg-muted animate-pulse rounded-[3px]" />
                                <div className="h-3 w-3/4 bg-muted/60 animate-pulse rounded-[3px]" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-[20px] font-semibold text-foreground mb-0.5">
                        Your Clients
                    </h2>
                    <p className="text-[14px] text-muted-foreground">
                        Manage and monitor customer success across all clients
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setConfigDialogOpen(true)}>
                        <Settings2 className="h-4 w-4" />
                        <span>Customize</span>
                    </Button>
                    <Button size="sm" onClick={() => setCreateClientOpen(true)}>
                        <Plus className="h-4 w-4" />
                        <span>New Client</span>
                    </Button>
                </div>
            </div>

            {clients.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="rounded-[3px] bg-muted p-5 mb-4">
                            <FolderOpen className="h-10 w-10 text-muted-foreground" />
                        </div>

                        <h3 className="text-[16px] font-semibold mb-1.5 text-foreground">No clients yet</h3>
                        <p className="text-[14px] text-muted-foreground text-center max-w-md mb-6">
                            Start managing your customer success by adding your first client organization.
                            Track their doctors, monitor engagement, and ensure successful onboarding.
                        </p>

                        <Button size="sm" onClick={() => setCreateClientOpen(true)}>
                            <Plus className="h-4 w-4" />
                            <span>Add Your First Client</span>
                        </Button>

                        {/* Quick Overview */}
                        <div className="mt-12 w-full max-w-2xl">
                            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                What you can track for each client:
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="flex flex-col items-start gap-1.5 p-3 rounded-[3px] bg-muted/50 border border-border">
                                    <Users className="h-4 w-4 text-[var(--notion-blue-text)]" />
                                    <div className="font-medium text-[13px]">Doctor Metrics</div>
                                    <p className="text-[12px] text-muted-foreground leading-snug">
                                        Total doctors, active users, and engagement rates
                                    </p>
                                </div>
                                <div className="flex flex-col items-start gap-1.5 p-3 rounded-[3px] bg-muted/50 border border-border">
                                    <BarChart3 className="h-4 w-4 text-[var(--notion-green-text)]" />
                                    <div className="font-medium text-[13px]">Performance</div>
                                    <p className="text-[12px] text-muted-foreground leading-snug">
                                        Cases submitted and course completion progress
                                    </p>
                                </div>
                                <div className="flex flex-col items-start gap-1.5 p-3 rounded-[3px] bg-muted/50 border border-border">
                                    <AlertTriangle className="h-4 w-4 text-[var(--notion-orange-text)]" />
                                    <div className="font-medium text-[13px]">Risk Tracking</div>
                                    <p className="text-[12px] text-muted-foreground leading-snug">
                                        Identify and manage at-risk doctors
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {clients.map((client) => (
                        <Card
                            key={client.id}
                            className="group hover:border-foreground/20 transition-colors duration-100 cursor-pointer"
                            onClick={() => router.push(`/clients/${client.id}`)}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between text-[15px]">
                                    <span>{client.name}</span>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-100" />
                                </CardTitle>
                                {client.industry && (
                                    <CardDescription className="text-[13px]">{client.industry}</CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Dynamic Metrics */}
                                <div className="grid grid-cols-2 gap-3">
                                    {metrics
                                        .filter(m => m.enabled)
                                        .sort((a, b) => a.order - b.order)
                                        .map(metric => renderMetric(metric.id, client))
                                        .filter(Boolean)}
                                </div>

                                {/* Contact Info */}
                                {client.contact_name && (
                                    <div className="pt-3 border-t border-border text-[12px] text-muted-foreground">
                                        Contact: {client.contact_name}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Card Configuration Dialog */}
            <CardConfigDialog
                open={configDialogOpen}
                onOpenChange={setConfigDialogOpen}
                metrics={metrics}
                onSave={saveMetricsConfig}
            />

            {/* Create Client Dialog */}
            <CreateClientDialog
                open={createClientOpen}
                onOpenChange={setCreateClientOpen}
            />
        </div>
    );
}
