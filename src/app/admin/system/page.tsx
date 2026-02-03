'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Clock, Activity } from 'lucide-react';

interface PerformanceMetrics {
  metrics: Array<{
    endpoint: string;
    method: string;
    duration: number;
    timestamp: string;
    slow: boolean;
  }>;
  summary: {
    total: number;
    slow: number;
    avgDuration: number;
    slowestEndpoints: Array<{
      endpoint: string;
      avgDuration: number;
      count: number;
    }>;
  };
}

export default function SystemHealthPage() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/metrics/performance');
      const data = await res.json();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getHealthStatus = () => {
    if (!metrics) return { status: 'unknown', color: 'text-gray-500' };
    const slowPercentage = metrics.summary.total > 0
      ? (metrics.summary.slow / metrics.summary.total) * 100
      : 0;

    if (slowPercentage > 20) return { status: 'Needs Attention', color: 'text-red-500' };
    if (slowPercentage > 10) return { status: 'Fair', color: 'text-yellow-500' };
    return { status: 'Healthy', color: 'text-green-500' };
  };

  const health = getHealthStatus();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">System Health</h1>
        <p className="text-muted-foreground mt-2">
          Bookmark this page to check system performance anytime.
        </p>
        {lastUpdated && (
          <p className="text-sm text-muted-foreground mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()} (auto-refreshes every 30s)
          </p>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Overall Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Overall Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold ${health.color}`}>
                {health.status === 'Healthy' && <CheckCircle className="inline h-10 w-10 mr-2" />}
                {health.status === 'Fair' && <Clock className="inline h-10 w-10 mr-2" />}
                {health.status === 'Needs Attention' && <AlertTriangle className="inline h-10 w-10 mr-2" />}
                {health.status}
              </div>
              <p className="text-muted-foreground mt-2">
                {health.status === 'Healthy' && 'All systems running smoothly.'}
                {health.status === 'Fair' && 'Some slowness detected. Monitor over next few days.'}
                {health.status === 'Needs Attention' && 'Multiple slow API calls. Consider reviewing DATABASE_MIGRATION_GUIDE.md'}
              </p>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total API Calls (recent)</CardDescription>
                <CardTitle className="text-3xl">{metrics?.summary.total || 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Slow Calls (&gt;200ms)</CardDescription>
                <CardTitle className={`text-3xl ${(metrics?.summary.slow || 0) > 5 ? 'text-red-500' : ''}`}>
                  {metrics?.summary.slow || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Response Time</CardDescription>
                <CardTitle className={`text-3xl ${(metrics?.summary.avgDuration || 0) > 200 ? 'text-yellow-500' : ''}`}>
                  {metrics?.summary.avgDuration || 0}ms
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Slowest Endpoints */}
          {metrics?.summary.slowestEndpoints && metrics.summary.slowestEndpoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Slowest Endpoints</CardTitle>
                <CardDescription>
                  These are the API calls taking the longest. Share this with your developer if needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.summary.slowestEndpoints.map((endpoint, i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                      <code className="text-sm bg-muted px-2 py-1 rounded">{endpoint.endpoint}</code>
                      <div className="text-right">
                        <span className={`font-mono ${endpoint.avgDuration > 200 ? 'text-red-500' : ''}`}>
                          {endpoint.avgDuration}ms
                        </span>
                        <span className="text-muted-foreground text-sm ml-2">({endpoint.count} calls)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Reference */}
          <Card>
            <CardHeader>
              <CardTitle>When to Take Action</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div><strong>Green/Healthy:</strong> No action needed. Check back weekly.</div>
                </div>
                <div className="flex gap-3">
                  <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <div><strong>Yellow/Fair:</strong> Monitor for a few days. If persistent, mention to developer.</div>
                </div>
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div><strong>Red/Needs Attention:</strong> Share this page with developer. Review migration guide if cost is also increasing.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <a
                  href="https://supabase.com/dashboard/project/vekxzuupejmitvwwokrf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:underline"
                >
                  Supabase Dashboard (billing, database, settings)
                </a>
                <p className="text-sm text-muted-foreground">
                  Check billing alerts at: Dashboard → Settings → Billing
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
