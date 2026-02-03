import { NextResponse } from 'next/server';
import { getRecentMetrics } from '@/lib/api-monitor';

/**
 * GET /api/metrics/performance
 *
 * Returns recent API performance metrics.
 * Use this to monitor which endpoints are slow.
 *
 * Response:
 * {
 *   metrics: [...],  // Last 100 API calls
 *   summary: {
 *     total: number,
 *     slow: number,
 *     avgDuration: number,
 *     slowestEndpoints: [...]
 *   }
 * }
 */
export async function GET() {
  // In production, you might want to restrict access to this endpoint
  const metrics = getRecentMetrics();

  return NextResponse.json(metrics);
}
