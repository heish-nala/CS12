import { NextRequest, NextResponse } from 'next/server';
import { getRecentMetrics } from '@/lib/api-monitor';
import { requireAuth } from '@/lib/auth';

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
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  const metrics = getRecentMetrics();

  return NextResponse.json(metrics);
}
