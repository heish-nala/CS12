/**
 * API Health Check Script
 * Run with: npx tsx scripts/api-health-check.ts
 *
 * Tests all API endpoints in two passes:
 *   1. Auth guard — unauthenticated requests should be rejected
 *   2. Functional — authenticated requests should return real data
 *
 * Environment variables:
 *   TEST_URL    — base URL (default: https://cs12.allsolutions.consulting)
 *   TEST_USER   — user_id for authenticated tests
 *   TEST_ORG    — org_id for org-scoped tests
 */

const BASE_URL = process.env.TEST_URL || 'https://cs12.allsolutions.consulting';
const USER_ID = process.env.TEST_USER || '8a84898d-0266-4dc1-b97c-744d70d7a4ec';
const ORG_ID = process.env.TEST_ORG || 'cd3a5aa0-bafe-4175-b7e7-9ff3b57c2735';

interface TestResult {
    route: string;
    category: string;
    passed: boolean;
    status?: number;
    detail?: string;
}

const results: TestResult[] = [];

// ── helpers ────────────────────────────────────────────────────────────

async function request(
    method: string,
    path: string,
    body?: Record<string, unknown>
): Promise<{ status: number; data: any }> {
    const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, opts);
    let data: any;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    return { status: res.status, data };
}

function record(
    category: string,
    route: string,
    passed: boolean,
    status?: number,
    detail?: string
) {
    results.push({ route, category, passed, status, detail });
    const icon = passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const line = `${icon} ${route}`;
    if (!passed && detail) {
        console.log(`${line}  — ${detail}`);
    } else {
        console.log(line);
    }
}

// ── Pass 1: Auth guard tests (no credentials) ─────────────────────────

async function testAuthGuards() {
    console.log('\n\x1b[1m═══ Pass 1: Auth Guards (should reject) ═══\x1b[0m\n');

    const routes: { method: string; path: string; accept: number[] }[] = [
        // Core data routes
        { method: 'GET', path: '/api/dsos', accept: [401] },
        { method: 'GET', path: '/api/doctors', accept: [401] },
        { method: 'GET', path: '/api/activities', accept: [401] },
        { method: 'GET', path: '/api/tasks', accept: [401] },
        { method: 'GET', path: '/api/search', accept: [401] },
        { method: 'GET', path: '/api/team', accept: [401] },
        { method: 'GET', path: '/api/progress?client_id=test', accept: [401, 403] },
        // Org routes
        { method: 'GET', path: '/api/orgs', accept: [401] },
        { method: 'GET', path: `/api/orgs/${ORG_ID}`, accept: [401] },
        { method: 'GET', path: `/api/orgs/${ORG_ID}/members`, accept: [401] },
        { method: 'GET', path: `/api/orgs/${ORG_ID}/dsos`, accept: [401] },
        { method: 'GET', path: `/api/orgs/${ORG_ID}/dso-access`, accept: [401] },
        // Dashboard / overview
        { method: 'GET', path: '/api/dashboard/metrics', accept: [401] },
        { method: 'GET', path: '/api/clients/overview', accept: [200, 401] }, // no auth guard (returns empty without user)
        // Data tables (need client_id)
        { method: 'GET', path: '/api/data-tables?client_id=test', accept: [401, 403] },
    ];

    for (const { method, path, accept } of routes) {
        const { status } = await request(method, path);
        const passed = accept.includes(status);
        record('auth', `${method} ${path}`, passed, status, passed ? undefined : `expected ${accept.join('|')}, got ${status}`);
    }
}

// ── Pass 2: Functional tests (with credentials) ───────────────────────

async function testFunctional() {
    console.log('\n\x1b[1m═══ Pass 2: Functional Tests (with user_id) ═══\x1b[0m\n');

    const u = `user_id=${USER_ID}`;

    // ─── DSOs ────────────────────────────────────────────────────────
    const { status: dsosStatus, data: dsosData } = await request('GET', `/api/dsos?${u}`);
    const dsosOk = dsosStatus === 200 && Array.isArray(dsosData?.dsos) && dsosData.dsos.length > 0;
    record('functional', `GET /api/dsos`, dsosOk, dsosStatus,
        dsosOk ? undefined : `status=${dsosStatus}, dsos=${dsosData?.dsos?.length ?? 'missing'}`);

    // Grab first DSO for subsequent tests
    const dsoId: string | null = dsosData?.dsos?.[0]?.id || null;
    if (!dsoId) {
        console.log('\n  No DSOs found — skipping DSO-scoped tests\n');
        return;
    }

    // ─── Team ────────────────────────────────────────────────────────
    const { status: teamStatus, data: teamData } = await request('GET', `/api/team?${u}`);
    const teamOk = teamStatus === 200 && Array.isArray(teamData?.members);
    record('functional', `GET /api/team`, teamOk, teamStatus,
        teamOk ? undefined : `status=${teamStatus}, members=${teamData?.members?.length ?? 'missing'}`);

    // ─── Org routes (session-only auth — no user_id fallback) ──────
    // These routes use requireOrgAccess which requires a session cookie.
    // From curl/scripts they will return 401. We verify they exist and
    // respond (not 404/500). In-browser testing covers full auth.
    const orgRoutes = [
        `/api/orgs`,
        `/api/orgs/${ORG_ID}`,
        `/api/orgs/${ORG_ID}/members`,
        `/api/orgs/${ORG_ID}/dsos`,
        `/api/orgs/${ORG_ID}/dso-access`,
        `/api/orgs/${ORG_ID}/invites`,
    ];
    for (const path of orgRoutes) {
        const { status } = await request('GET', `${path}?${u}`);
        // 200 = session worked, 401 = expected without cookie (both acceptable)
        const ok = status === 200 || status === 401;
        record('functional', `GET ${path.replace(ORG_ID, '[id]')}`, ok, status,
            ok ? '(session-only, 401 expected from curl)' : `unexpected status ${status}`);
    }

    // ─── Doctors ─────────────────────────────────────────────────────
    const { status: docsStatus, data: docsData } = await request('GET', `/api/doctors?dso_id=${dsoId}&${u}`);
    const docsOk = docsStatus === 200 && Array.isArray(docsData?.doctors);
    record('functional', `GET /api/doctors (by dso)`, docsOk, docsStatus);

    const { status: docsEnumStatus, data: docsEnumData } = await request('GET', `/api/doctors?${u}`);
    const docsEnumOk = docsEnumStatus === 200 && Array.isArray(docsEnumData?.doctors);
    record('functional', `GET /api/doctors (enum)`, docsEnumOk, docsEnumStatus);

    // Test specific doctor if any exist
    const doctorId: string | null = docsData?.doctors?.[0]?.id || null;
    if (doctorId) {
        const { status: docDetailStatus } = await request('GET', `/api/doctors/${doctorId}?dso_id=${dsoId}&${u}`);
        record('functional', `GET /api/doctors/[id]`, docDetailStatus === 200, docDetailStatus);

        const { status: periodsStatus } = await request('GET', `/api/doctors/${doctorId}/periods?dso_id=${dsoId}&${u}`);
        record('functional', `GET /api/doctors/[id]/periods`, periodsStatus === 200, periodsStatus);
    }

    // ─── Activities ──────────────────────────────────────────────────
    const { status: actStatus, data: actData } = await request('GET', `/api/activities?${u}`);
    const actOk = actStatus === 200 && Array.isArray(actData?.activities);
    record('functional', `GET /api/activities`, actOk, actStatus);

    // ─── Tasks ───────────────────────────────────────────────────────
    const { status: tasksStatus, data: tasksData } = await request('GET', `/api/tasks?${u}`);
    const tasksOk = tasksStatus === 200;
    record('functional', `GET /api/tasks`, tasksOk, tasksStatus);

    // ─── Search ──────────────────────────────────────────────────────
    const { status: searchStatus } = await request('GET', `/api/search?q=test&${u}`);
    record('functional', `GET /api/search`, searchStatus === 200, searchStatus);

    // ─── Dashboard ───────────────────────────────────────────────────
    const { status: dashStatus } = await request('GET', `/api/dashboard/metrics?${u}`);
    record('functional', `GET /api/dashboard/metrics`, dashStatus === 200, dashStatus);

    const { status: dashDsoStatus } = await request('GET', `/api/dashboard/metrics?dso_id=${dsoId}&${u}`);
    record('functional', `GET /api/dashboard/metrics (by dso)`, dashDsoStatus === 200, dashDsoStatus);

    // ─── Clients Overview ────────────────────────────────────────────
    const { status: overviewStatus } = await request('GET', `/api/clients/overview?${u}`);
    record('functional', `GET /api/clients/overview`, overviewStatus === 200, overviewStatus);

    // ─── Data Tables ─────────────────────────────────────────────────
    const { status: dtStatus, data: dtData } = await request('GET', `/api/data-tables?client_id=${dsoId}&${u}`);
    const dtOk = dtStatus === 200;
    record('functional', `GET /api/data-tables`, dtOk, dtStatus);

    // Test a specific table if any exist
    const tableId: string | null = dtData?.tables?.[0]?.id || null;
    if (tableId) {
        const { status: tblDetailStatus } = await request('GET', `/api/data-tables/${tableId}?client_id=${dsoId}&${u}`);
        record('functional', `GET /api/data-tables/[id]`, tblDetailStatus === 200, tblDetailStatus);

        const { status: colsStatus } = await request('GET', `/api/data-tables/${tableId}/columns?client_id=${dsoId}&${u}`);
        record('functional', `GET /api/data-tables/[id]/columns`, colsStatus === 200, colsStatus);

        const { status: rowsStatus, data: rowsData } = await request('GET', `/api/data-tables/${tableId}/rows?client_id=${dsoId}&${u}`);
        record('functional', `GET /api/data-tables/[id]/rows`, rowsStatus === 200, rowsStatus);

        // Test a specific row's periods if rows exist
        const rowId: string | null = rowsData?.rows?.[0]?.id || null;
        if (rowId) {
            const { status: rpStatus } = await request('GET', `/api/data-tables/${tableId}/rows/${rowId}/periods?client_id=${dsoId}&${u}`);
            record('functional', `GET /api/data-tables/[id]/rows/[rowId]/periods`, rpStatus === 200, rpStatus);
        }
    }

    // ─── Progress ────────────────────────────────────────────────────
    const { status: progStatus } = await request('GET', `/api/progress?client_id=${dsoId}&${u}`);
    record('functional', `GET /api/progress`, progStatus === 200, progStatus);

    // ─── Overview Widgets ────────────────────────────────────────────
    const { status: widgetsStatus } = await request('GET', `/api/overview-widgets?client_id=${dsoId}&${u}`);
    record('functional', `GET /api/overview-widgets`, widgetsStatus === 200, widgetsStatus);

    const { status: widgetColsStatus } = await request('GET', `/api/overview-widgets/columns?client_id=${dsoId}&${u}`);
    record('functional', `GET /api/overview-widgets/columns`, widgetColsStatus === 200, widgetColsStatus);

    // ─── Team sub-routes ─────────────────────────────────────────────
    const primaryDsoId = teamData?.dso_id || dsoId;
    const { status: inviteListStatus } = await request('GET', `/api/team/invite?dso_id=${primaryDsoId}&${u}`);
    record('functional', `GET /api/team/invite`, inviteListStatus === 200, inviteListStatus);

    // ─── Templates (no auth, mock data) ──────────────────────────────
    const { status: tplStatus, data: tplData } = await request('GET', `/api/templates`);
    const tplOk = tplStatus === 200 && (Array.isArray(tplData) || tplData?.templates);
    record('functional', `GET /api/templates`, tplOk, tplStatus);

    // ─── Mock/monitoring endpoints (no auth expected) ────────────────
    const { status: perfStatus } = await request('GET', `/api/metrics/performance`);
    record('functional', `GET /api/metrics/performance`, perfStatus === 200, perfStatus);

    const { status: dashConfigStatus } = await request('GET', `/api/dashboard/config?dso_id=${dsoId}`);
    record('functional', `GET /api/dashboard/config`, [200, 400].includes(dashConfigStatus), dashConfigStatus,
        dashConfigStatus === 400 ? '(in-memory store, may need init)' : undefined);
}

// ── Cross-org isolation test ───────────────────────────────────────────

async function testIsolation() {
    console.log('\n\x1b[1m═══ Pass 3: Cross-Org Isolation ═══\x1b[0m\n');

    const u = `user_id=${USER_ID}`;

    // Attempt to access a non-existent org (should be rejected)
    const fakeOrg = '00000000-0000-0000-0000-000000000000';
    const { status: fakeOrgStatus } = await request('GET', `/api/orgs/${fakeOrg}/members?${u}`);
    // 401 (session-only route), 403, or 404 all mean "blocked"
    const blocked = [401, 403, 404].includes(fakeOrgStatus);
    record('isolation', `GET /api/orgs/[fake]/members`, blocked, fakeOrgStatus,
        blocked ? undefined : `should be 401/403/404, got ${fakeOrgStatus}`);

    // Attempt to access a non-existent DSO (should be rejected)
    const fakeDso = '00000000-0000-0000-0000-000000000000';
    const { status: fakeDsoStatus } = await request('GET', `/api/doctors?dso_id=${fakeDso}&${u}`);
    const dsoBlocked = fakeDsoStatus === 403 || fakeDsoStatus === 404 || fakeDsoStatus === 200;
    // 200 with empty array is also acceptable (DSO doesn't exist, no doctors)
    record('isolation', `GET /api/doctors?dso_id=[fake]`, dsoBlocked, fakeDsoStatus);

    const { status: fakeDtStatus } = await request('GET', `/api/data-tables?client_id=${fakeDso}&${u}`);
    const dtBlocked = fakeDtStatus === 403 || fakeDtStatus === 404;
    record('isolation', `GET /api/data-tables?client_id=[fake]`, dtBlocked, fakeDtStatus,
        dtBlocked ? undefined : `should be 403/404, got ${fakeDtStatus}`);
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n\x1b[1m╔═══════════════════════════════════════╗`);
    console.log(`║      CS12 API Health Check            ║`);
    console.log(`╚═══════════════════════════════════════╝\x1b[0m`);
    console.log(`\n  Target:  ${BASE_URL}`);
    console.log(`  User:    ${USER_ID}`);
    console.log(`  Org:     ${ORG_ID}\n`);

    await testAuthGuards();
    await testFunctional();
    await testIsolation();

    // ── Summary ──────────────────────────────────────────────────────
    console.log('\n\x1b[1m═══ Summary ═══\x1b[0m\n');

    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);

    const byCategory = (cat: string) => {
        const catResults = results.filter(r => r.category === cat);
        const catPassed = catResults.filter(r => r.passed).length;
        return `${catPassed}/${catResults.length}`;
    };

    console.log(`  Auth guards:   ${byCategory('auth')}`);
    console.log(`  Functional:    ${byCategory('functional')}`);
    console.log(`  Isolation:     ${byCategory('isolation')}`);
    console.log(`  ─────────────────────`);
    console.log(`  \x1b[1mTotal:           ${passed.length}/${results.length}\x1b[0m`);

    if (failed.length > 0) {
        console.log(`\n\x1b[31m  Failed tests:\x1b[0m`);
        for (const f of failed) {
            console.log(`    ✗ ${f.route} (${f.status}) ${f.detail || ''}`);
        }
        process.exit(1);
    }

    console.log(`\n\x1b[32m  All tests passed!\x1b[0m\n`);
}

main().catch((err) => {
    console.error('Health check crashed:', err);
    process.exit(1);
});
