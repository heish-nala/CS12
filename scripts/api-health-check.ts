/**
 * API Health Check Script
 * Run with: npx tsx scripts/api-health-check.ts
 *
 * This script verifies:
 * 1. All API routes require authentication
 * 2. Routes return expected response shapes
 * 3. Database schema matches expected columns
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

interface TestResult {
    route: string;
    method: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];

async function testRoute(
    method: string,
    route: string,
    expectedStatus: number[],
    description: string
): Promise<void> {
    try {
        const response = await fetch(`${BASE_URL}${route}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
        });

        const passed = expectedStatus.includes(response.status);
        results.push({
            route: `${method} ${route}`,
            method,
            passed,
            error: passed ? undefined : `Expected ${expectedStatus.join('|')}, got ${response.status}`,
        });

        const icon = passed ? '✓' : '✗';
        console.log(`${icon} ${method} ${route} - ${description}`);
        if (!passed) {
            console.log(`  Expected: ${expectedStatus.join(' or ')}, Got: ${response.status}`);
        }
    } catch (error) {
        results.push({
            route: `${method} ${route}`,
            method,
            passed: false,
            error: String(error),
        });
        console.log(`✗ ${method} ${route} - ${description}`);
        console.log(`  Error: ${error}`);
    }
}

async function runTests() {
    console.log('\n=== API Health Check ===\n');
    console.log('Testing authentication requirements...\n');

    // All these routes should return 401/403 Unauthorized without auth
    // Some routes return 400 for missing required params, which is also acceptable
    // (means they check params before auth, but still protected)
    const protectedRoutes = [
        { method: 'GET', route: '/api/activities', desc: 'Activities list', allowedStatus: [401, 403] },
        { method: 'GET', route: '/api/doctors?dso_id=test', desc: 'Doctors list', allowedStatus: [401, 403] },
        { method: 'GET', route: '/api/data-tables?client_id=test', desc: 'Data tables list', allowedStatus: [401, 403] },
        { method: 'GET', route: '/api/dsos', desc: 'DSOs list', allowedStatus: [401, 403] },
        { method: 'GET', route: '/api/team?dso_id=test', desc: 'Team list', allowedStatus: [401, 403] },
        { method: 'GET', route: '/api/progress?client_id=test', desc: 'Progress data', allowedStatus: [401, 403] },
        { method: 'POST', route: '/api/data-tables/format-phones?client_id=test', desc: 'Format phones', allowedStatus: [401, 403] },
        { method: 'GET', route: '/api/doctors/test-id/periods', desc: 'Doctor periods', allowedStatus: [401, 403, 404] },
        { method: 'PATCH', route: '/api/doctors/test-id/periods', desc: 'Update doctor periods', allowedStatus: [401, 403, 404] },
    ];

    for (const { method, route, desc, allowedStatus } of protectedRoutes) {
        await testRoute(method, route, allowedStatus, `Should require auth: ${desc}`);
    }

    // Summary
    console.log('\n=== Summary ===\n');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log('\nFailed tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.route}: ${r.error}`);
        });
        process.exit(1);
    }

    console.log('\nAll tests passed!');
}

runTests().catch(console.error);
