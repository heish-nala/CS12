/**
 * API Performance Monitor
 *
 * Tracks API response times and logs slow queries.
 * Data is logged to console in development and can be extended
 * to send to analytics services in production.
 */

// Threshold in milliseconds - queries slower than this get flagged
const SLOW_QUERY_THRESHOLD = 200;

// Store metrics in memory for the /api/metrics/performance endpoint
interface ApiMetric {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: Date;
  slow: boolean;
}

// Keep last 100 metrics in memory (simple ring buffer)
const metricsBuffer: ApiMetric[] = [];
const MAX_METRICS = 100;

function addMetric(metric: ApiMetric) {
  metricsBuffer.push(metric);
  if (metricsBuffer.length > MAX_METRICS) {
    metricsBuffer.shift();
  }
}

/**
 * Wraps an API handler to track performance
 *
 * Usage:
 *   export const GET = withMonitoring(async (request) => {
 *     // your handler code
 *   });
 */
export function withMonitoring<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  endpointName?: string
): T {
  return (async (...args: unknown[]) => {
    const start = performance.now();
    const request = args[0] as Request;
    const method = request?.method || 'UNKNOWN';
    const url = request?.url || 'unknown';
    const endpoint = endpointName || new URL(url).pathname;

    try {
      const response = await handler(...args);
      const duration = performance.now() - start;
      const slow = duration > SLOW_QUERY_THRESHOLD;

      // Log performance data
      const metric: ApiMetric = {
        endpoint,
        method,
        duration: Math.round(duration),
        timestamp: new Date(),
        slow,
      };

      addMetric(metric);

      // Log slow queries prominently
      if (slow) {
        console.warn(
          `[SLOW API] ${method} ${endpoint} took ${Math.round(duration)}ms (threshold: ${SLOW_QUERY_THRESHOLD}ms)`
        );
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`[API] ${method} ${endpoint} - ${Math.round(duration)}ms`);
      }

      return response;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`[API ERROR] ${method} ${endpoint} - ${Math.round(duration)}ms`, error);
      throw error;
    }
  }) as T;
}

/**
 * Get recent API metrics for the performance dashboard
 */
export function getRecentMetrics() {
  return {
    metrics: [...metricsBuffer],
    summary: {
      total: metricsBuffer.length,
      slow: metricsBuffer.filter(m => m.slow).length,
      avgDuration: metricsBuffer.length > 0
        ? Math.round(metricsBuffer.reduce((sum, m) => sum + m.duration, 0) / metricsBuffer.length)
        : 0,
      slowestEndpoints: getTopSlowest(5),
    },
  };
}

function getTopSlowest(n: number) {
  const byEndpoint = new Map<string, number[]>();

  for (const metric of metricsBuffer) {
    const key = `${metric.method} ${metric.endpoint}`;
    if (!byEndpoint.has(key)) {
      byEndpoint.set(key, []);
    }
    byEndpoint.get(key)!.push(metric.duration);
  }

  return Array.from(byEndpoint.entries())
    .map(([endpoint, durations]) => ({
      endpoint,
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      count: durations.length,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, n);
}
