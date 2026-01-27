'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import {
    Users,
    TrendingUp,
    AlertTriangle,
    ArrowUpRight,
    Plus,
    Settings2,
    Building2,
    Activity,
    ChevronRight,
} from 'lucide-react';
import { CardConfigDialog, MetricConfig, DEFAULT_METRICS } from './card-config-dialog';
import { CreateClientDialog } from './create-client-dialog';
import { useAuth } from '@/contexts/auth-context';
import { SparkChart, generateTrendData } from '@/components/ui/spark-chart';

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

// Summary stat card component
function StatCard({
    label,
    value,
    trend,
    icon: Icon,
    trendData,
}: {
    label: string;
    value: string | number;
    trend?: { value: number; label: string };
    icon: React.ElementType;
    trendData?: number[];
}) {
    const isPositive = trend && trend.value >= 0;

    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all duration-200">
            <div className="flex-shrink-0 p-2.5 rounded-lg bg-primary/10">
                <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground truncate">{label}</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
                    {trend && (
                        <span className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isPositive ? '+' : ''}{trend.value}% {trend.label}
                        </span>
                    )}
                </div>
            </div>
            {trendData && (
                <div className="flex-shrink-0">
                    <SparkChart data={trendData} width={64} height={24} />
                </div>
            )}
        </div>
    );
}

// Client card component
function ClientCard({
    client,
    metrics,
    onClick,
}: {
    client: ClientWithMetrics;
    metrics: MetricConfig[];
    onClick: () => void;
}) {
    const enabledMetrics = metrics.filter(m => m.enabled).sort((a, b) => a.order - b.order);

    const getMetricDisplay = (metricId: string) => {
        switch (metricId) {
            case 'total_doctors':
                return {
                    label: 'Doctors',
                    value: client.metrics.total_doctors,
                    sub: `${client.metrics.active_doctors} active`,
                    trendData: generateTrendData(client.metrics.total_doctors, 0.1),
                };
            case 'active_doctors':
                return {
                    label: 'Active',
                    value: client.metrics.active_doctors,
                    sub: `of ${client.metrics.total_doctors}`,
                    trendData: generateTrendData(client.metrics.active_doctors, 0.15),
                };
            case 'engagement_rate':
                return {
                    label: 'Engagement',
                    value: `${client.metrics.engagement_rate}%`,
                    sub: 'Last 7 days',
                    trendData: generateTrendData(client.metrics.engagement_rate, 0.12),
                };
            case 'at_risk_count':
                return client.metrics.at_risk_count > 0 ? {
                    label: 'At Risk',
                    value: client.metrics.at_risk_count,
                    sub: 'Need attention',
                    isWarning: true,
                } : null;
            case 'total_cases':
                return {
                    label: 'Cases',
                    value: client.metrics.total_cases,
                    trendData: generateTrendData(client.metrics.total_cases, 0.2),
                };
            case 'avg_course_progress':
                return {
                    label: 'Progress',
                    value: `${client.metrics.avg_course_progress}%`,
                    trendData: generateTrendData(client.metrics.avg_course_progress, 0.1),
                };
            default:
                return null;
        }
    };

    return (
        <div
            onClick={onClick}
            className="group relative p-5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {client.industry && (
                        <p className="text-sm text-muted-foreground mt-0.5">{client.industry}</p>
                    )}
                </div>
                {client.metrics.at_risk_count > 0 && (
                    <div className="flex-shrink-0 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <span className="text-xs font-medium text-amber-600">
                            {client.metrics.at_risk_count} at risk
                        </span>
                    </div>
                )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
                {enabledMetrics.slice(0, 4).map(metric => {
                    const display = getMetricDisplay(metric.id);
                    if (!display) return null;

                    return (
                        <div key={metric.id} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{display.label}</p>
                            <div className="flex items-center justify-between">
                                <span className={`text-lg font-semibold tabular-nums ${display.isWarning ? 'text-amber-600' : 'text-foreground'}`}>
                                    {display.value}
                                </span>
                                {display.trendData && (
                                    <SparkChart data={display.trendData} width={48} height={18} />
                                )}
                            </div>
                            {display.sub && (
                                <p className="text-xs text-muted-foreground">{display.sub}</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            {client.contact_name && (
                <div className="mt-4 pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground">
                        Contact: <span className="text-foreground">{client.contact_name}</span>
                    </p>
                </div>
            )}

            {/* Hover indicator */}
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-xl" />
        </div>
    );
}

// Empty state component
function EmptyState({ onCreateClient }: { onCreateClient: () => void }) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-muted/20 to-muted/5">
            <div className="relative flex flex-col items-center justify-center py-16 px-6">
                <div className="p-4 rounded-2xl bg-primary/10 mb-4">
                    <Building2 className="w-8 h-8 text-primary" />
                </div>

                <h3 className="text-lg font-semibold mb-2 text-foreground">No clients yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                    Start managing your customer success by adding your first client.
                    Track their doctors, monitor engagement, and ensure successful onboarding.
                </p>

                <Button onClick={onCreateClient} className="shadow-sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Client
                </Button>

                {/* Feature highlights */}
                <div className="mt-12 w-full max-w-2xl">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
                        What you can track
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {[
                            { icon: Users, title: 'Doctor Metrics', desc: 'Track engagement and activity' },
                            { icon: Activity, title: 'Performance', desc: 'Cases and course progress' },
                            { icon: AlertTriangle, title: 'Risk Alerts', desc: 'Identify at-risk doctors' },
                        ].map((feature) => (
                            <div
                                key={feature.title}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border/50 text-center"
                            >
                                <feature.icon className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="font-medium text-sm">{feature.title}</p>
                                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Loading skeleton
function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            {/* Stats skeleton */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-4 rounded-xl bg-card border border-border/50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Cards skeleton */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-5 rounded-xl bg-card border border-border/50">
                        <div className="space-y-4">
                            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-24 bg-muted/60 animate-pulse rounded" />
                            <div className="grid grid-cols-2 gap-3">
                                {[...Array(4)].map((_, j) => (
                                    <div key={j} className="space-y-2">
                                        <div className="h-3 w-16 bg-muted/60 animate-pulse rounded" />
                                        <div className="h-5 w-12 bg-muted animate-pulse rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
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

    // Calculate summary stats
    const summaryStats = useMemo(() => {
        const totalDoctors = clients.reduce((sum, c) => sum + c.metrics.total_doctors, 0);
        const activeDoctors = clients.reduce((sum, c) => sum + c.metrics.active_doctors, 0);
        const atRisk = clients.reduce((sum, c) => sum + c.metrics.at_risk_count, 0);
        const avgEngagement = clients.length > 0
            ? Math.round(clients.reduce((sum, c) => sum + c.metrics.engagement_rate, 0) / clients.length)
            : 0;

        return { totalDoctors, activeDoctors, atRisk, avgEngagement, clientCount: clients.length };
    }, [clients]);

    if (loading) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Summary Stats Bar */}
            {clients.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Total Clients"
                        value={summaryStats.clientCount}
                        icon={Building2}
                        trendData={generateTrendData(summaryStats.clientCount, 0.1)}
                    />
                    <StatCard
                        label="Total Doctors"
                        value={summaryStats.totalDoctors}
                        trend={{ value: 12, label: 'this month' }}
                        icon={Users}
                        trendData={generateTrendData(summaryStats.totalDoctors, 0.15)}
                    />
                    <StatCard
                        label="Avg Engagement"
                        value={`${summaryStats.avgEngagement}%`}
                        trend={{ value: 5, label: 'vs last week' }}
                        icon={TrendingUp}
                        trendData={generateTrendData(summaryStats.avgEngagement, 0.12)}
                    />
                    <StatCard
                        label="At Risk"
                        value={summaryStats.atRisk}
                        icon={AlertTriangle}
                        trendData={generateTrendData(summaryStats.atRisk, 0.2)}
                    />
                </div>
            )}

            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        {clients.length > 0 ? 'Your Clients' : 'Get Started'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {clients.length > 0
                            ? `Managing ${clients.length} client${clients.length !== 1 ? 's' : ''}`
                            : 'Add your first client to begin tracking'}
                    </p>
                </div>
                {clients.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfigDialogOpen(true)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <Settings2 className="w-4 h-4 mr-1.5" />
                            Customize
                        </Button>
                        <Button size="sm" onClick={() => setCreateClientOpen(true)} className="shadow-sm">
                            <Plus className="w-4 h-4 mr-1.5" />
                            New Client
                        </Button>
                    </div>
                )}
            </div>

            {/* Content */}
            {clients.length === 0 ? (
                <EmptyState onCreateClient={() => setCreateClientOpen(true)} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {clients.map((client) => (
                        <ClientCard
                            key={client.id}
                            client={client}
                            metrics={metrics}
                            onClick={() => router.push(`/clients/${client.id}`)}
                        />
                    ))}
                </div>
            )}

            {/* Dialogs */}
            <CardConfigDialog
                open={configDialogOpen}
                onOpenChange={setConfigDialogOpen}
                metrics={metrics}
                onSave={saveMetricsConfig}
            />
            <CreateClientDialog
                open={createClientOpen}
                onOpenChange={setCreateClientOpen}
            />
        </div>
    );
}
