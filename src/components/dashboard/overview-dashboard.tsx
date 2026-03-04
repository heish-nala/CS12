'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OverviewDashboardResponse } from '@/lib/db/types';
import { Users, Activity, BarChart3, Target, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface OverviewDashboardProps {
    dsoId?: string;
}

export function OverviewDashboard({ dsoId }: OverviewDashboardProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<OverviewDashboardResponse | null>(null);

    const fetchDashboard = useCallback(async () => {
        if (!dsoId) {
            setLoading(false);
            return;
        }

        try {
            const userIdParam = user?.id ? `&user_id=${user.id}` : '';
            const response = await fetch(`/api/overview-dashboard?client_id=${dsoId}${userIdParam}`);
            const json = await response.json();
            setData(json);
        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
        }
    }, [dsoId, user?.id]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-48 bg-muted/30 animate-pulse rounded-xl border border-border/50" />
                    ))}
                </div>
            </div>
        );
    }

    // Empty state
    if (!data || data.total_attendees === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
                    <p className="text-muted-foreground">Dashboard metrics from your attendee data</p>
                </div>
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="rounded-full bg-muted p-6 mb-6">
                            <Users className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No Attendee Data Yet</h3>
                        <p className="text-muted-foreground text-center max-w-md">
                            Create an Attendee Tracker in the Attendees tab to see your dashboard metrics here.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Count active attendees from status data
    const activeCount = data.attendees_by_status.find(
        s => s.label.toLowerCase() === 'active'
    )?.value ?? 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
                <p className="text-muted-foreground">Dashboard metrics from your attendee data</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                    title="Total Attendees"
                    value={data.total_attendees}
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                />
                <SummaryCard
                    title="Active"
                    value={activeCount}
                    icon={<Activity className="h-4 w-4 text-muted-foreground" />}
                />
                <SummaryCard
                    title="Avg Blueprint"
                    value={`${data.blueprint_completion.average_percent}%`}
                    icon={<Target className="h-4 w-4 text-muted-foreground" />}
                />
                <SummaryCard
                    title="Calls This Month"
                    value={data.activity_summary.total_this_month}
                    icon={<Phone className="h-4 w-4 text-muted-foreground" />}
                />
            </div>

            {/* Status + Role Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                {data.attendees_by_status.length > 0 && (
                    <BarChartCard title="Attendees by Status" data={data.attendees_by_status} />
                )}
                {data.attendees_by_role.length > 0 && (
                    <BarChartCard title="Attendees by Role" data={data.attendees_by_role} />
                )}
            </div>

            {/* Blueprint Distribution + Clinical Funnel */}
            <div className="grid gap-4 md:grid-cols-2">
                {data.blueprint_completion.distribution.length > 0 && (
                    <BarChartCard title="Blueprint Distribution" data={data.blueprint_completion.distribution} />
                )}
                {data.clinical_funnel.stages.length > 0 && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Clinical Funnel
                            </CardTitle>
                            <span className="text-xs text-muted-foreground">{data.clinical_funnel.period_label}</span>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {data.clinical_funnel.stages.map((stage, i) => {
                                    const maxVal = Math.max(...data.clinical_funnel.stages.map(s => s.value), 1);
                                    return (
                                        <div key={i} className="flex items-center gap-3">
                                            <Badge variant="outline" className="min-w-[100px] justify-center">
                                                {stage.label}
                                            </Badge>
                                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-blue-500 transition-all"
                                                    style={{ width: `${(stage.value / maxVal) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium min-w-[40px] text-right">
                                                {stage.value}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Activity Summary */}
            {(data.activity_summary.total_this_month > 0 || data.activity_summary.last_contact_date) && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Activity This Month</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                            {data.activity_summary.by_type.map((item, i) => (
                                <span key={i}>
                                    <span className="font-medium">{item.label}:</span>{' '}
                                    <span className="text-muted-foreground">{item.value}</span>
                                </span>
                            ))}
                            {data.activity_summary.last_contact_date && (
                                <>
                                    <span className="text-border">|</span>
                                    <span className="text-muted-foreground">
                                        Last contact:{' '}
                                        {new Date(data.activity_summary.last_contact_date).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </span>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function SummaryCard({
    title,
    value,
    icon,
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}

function BarChartCard({
    title,
    data,
}: {
    title: string;
    data: Array<{ label: string; value: number; color: string }>;
}) {
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                            <Badge
                                variant="outline"
                                className="min-w-[100px] justify-center"
                                style={{
                                    backgroundColor: `${item.color}15`,
                                    borderColor: `${item.color}40`,
                                    color: item.color,
                                }}
                            >
                                {item.label}
                            </Badge>
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${(item.value / maxValue) * 100}%`,
                                        backgroundColor: item.color,
                                    }}
                                />
                            </div>
                            <span className="text-sm font-medium min-w-[40px] text-right">
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
