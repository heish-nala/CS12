# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Frameworks

**Unit/Component Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`
- Environment: jsdom (browser-like DOM)
- React plugin via `@vitejs/plugin-react`

**E2E Runner:**
- Playwright 1.57
- Config: `playwright.config.ts`
- Browser: Chromium only (Desktop Chrome viewport)
- Accessibility: `@axe-core/playwright` for WCAG checks

**Assertion Library:**
- Vitest built-in (`expect`)
- Playwright built-in (`expect` from `@playwright/test`)

**Component Testing:**
- `@testing-library/react` 16.x
- `@testing-library/dom` 10.x

**Run Commands:**
```bash
npm run test               # Run Vitest unit tests
npm run test:e2e           # Playwright smoke test (tests/example.spec.ts)
npm run test:ux            # Playwright UX/a11y suite (tests/ux.spec.ts)
npm run test:api           # API health check script (scripts/api-health-check.ts)
npm run qa                 # QA agent script (scripts/qa-agent.ts)
npm run precheck           # Build + API health check combined
```

## Test File Organization

**Unit tests — co-located with source:**
- Only one unit test file exists: `src/app/page.test.tsx` (co-located next to `src/app/page.tsx`)
- Naming pattern: `[filename].test.tsx`

**E2E tests — separate `tests/` directory:**
```
tests/
├── example.spec.ts    # Smoke test: page title check
└── ux.spec.ts         # Full UX/a11y/performance suite
```

**Scripts (not test framework, but test-adjacent):**
```
scripts/
├── api-health-check.ts    # Auth verification for all 31 API routes
└── qa-agent.ts            # QA automation agent
```

## Unit Test Structure

**Only existing unit test** — `src/app/page.test.tsx`:
```typescript
import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from './page'

// Mocks declared at module level (before tests)
vi.mock('next/navigation', () => ({ ... }))
vi.mock('@/contexts/auth-context', () => ({ ... }))
vi.mock('@/contexts/clients-context', () => ({ ... }))

// Global fetch mock reset before each test
beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clients: [] }),
    })
})

test('Page renders homepage with correct heading', () => {
    render(<Page />)
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(screen.getByText('Customer Success')).toBeDefined()
})
```

**Patterns observed:**
- Flat `test()` calls, no `describe()` nesting in unit tests
- `screen.getByText()` for DOM queries (Testing Library)
- `.toBeDefined()` for existence checks (not `.toBeInTheDocument()`)
- No async/await in this test (synchronous render check)

## Mocking

**Framework:** Vitest `vi`

**Next.js navigation mock:**
```typescript
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}))
```

**Context mocks — return mock data objects:**
```typescript
vi.mock('@/contexts/auth-context', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id', email: 'test@example.com' },
        loading: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        signInWithGoogle: vi.fn(),
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))
```

**Fetch mock:**
```typescript
beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clients: [] }),
    })
})
```

**What to mock:**
- `next/navigation` hooks (always — required for Next.js App Router components)
- Context providers and hooks (mock the hook return value, render Provider as passthrough)
- `global.fetch` for components that make API calls

**What NOT to mock:**
- Pure utility functions in `src/lib/calculations/` — test these directly
- Type definitions from `src/lib/db/types.ts`

## Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        exclude: ['tests/**', 'node_modules/**'],  // Excludes Playwright tests
        alias: {
            '@': path.resolve(__dirname, './src'),  // Matches tsconfig paths
        },
    },
})
```

Key notes:
- `tests/` directory is explicitly excluded — Playwright tests don't run under Vitest
- `@/` alias must be declared here separately from tsconfig

## E2E Test Structure (Playwright)

**Configuration:**
```typescript
// playwright.config.ts
{
    testDir: './tests',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    webServer: {
        command: 'npm run dev',
        reuseExistingServer: !process.env.CI,  // Reuses running dev server locally
    }
}
```

**Suite organization** (`tests/ux.spec.ts`):
```typescript
test.describe('Accessibility (a11y) Tests', () => {
    test('should have no accessibility violations on homepage', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // ...
    });
});
```

**Describe blocks used for grouping:**
- `Accessibility (a11y) Tests` — WCAG 2.0/2.1 AA via axe-core
- `Interactive Element UX Tests` — touch targets, form labels, focus indicators
- `Responsive Design Tests` — 3 viewports (375, 768, 1280px)
- `Color Contrast Tests` — axe-core color-contrast rule
- `Performance & Core Web Vitals` — LCP, CLS, load time
- `Navigation & Usability Tests` — keyboard nav, link text, heading hierarchy
- `Error State UX Tests` — 404 handling

## API Health Check Pattern

`scripts/api-health-check.ts` is a custom TypeScript script (not a test framework):

```typescript
interface TestResult {
    route: string;
    method: string;
    passed: boolean;
    error?: string;
}

async function testRoute(method, route, expectedStatus[], description) {
    const response = await fetch(`${BASE_URL}${route}`, { method });
    const passed = expectedStatus.includes(response.status);
    // logs ✓ or ✗
}
```

- Verifies all 31 API routes return 401/403 without auth
- Run with `npx tsx scripts/api-health-check.ts` or `npm run test:api`
- Uses `TEST_URL` env var, defaults to `http://localhost:3000`

## Coverage

**Requirements:** No coverage thresholds configured — coverage is not enforced.

**View Coverage:**
```bash
npx vitest --coverage    # Not configured in package.json scripts
```

## Test Types Summary

**Unit Tests:**
- Scope: Individual React page components
- Location: Co-located as `[file].test.tsx`
- Currently: 1 file (`src/app/page.test.tsx`) — very limited coverage

**E2E Tests (Playwright):**
- Scope: Full browser interaction against running dev server
- Focus: Accessibility (WCAG 2.0/2.1 AA), responsive design, Core Web Vitals, UX quality
- Location: `tests/` directory

**Integration/API Tests:**
- Custom script, not a test framework
- Scope: Verifies auth protection on all API routes
- Location: `scripts/api-health-check.ts`

## Common Patterns

**Async E2E Testing:**
```typescript
test('should have no accessibility violations on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

    expect(results.violations).toEqual([]);
});
```

**Soft assertions with logging (E2E):**
```typescript
if (smallTargets.length > 0) {
    console.log('\n=== Touch Target Size Issues ===');
    smallTargets.forEach((target) => console.log(`  - ${target}`));
}
// Warning only — allows some failures
expect(smallTargets.length).toBeLessThan(10);
```

**Viewport testing (E2E):**
```typescript
const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 800 },
];

for (const viewport of viewports) {
    test(`should render correctly on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        // ...
    });
}
```

## Test Coverage Gaps

Unit test coverage is extremely thin — only 1 unit test file exists for the entire application. The following have no unit tests:

- `src/lib/calculations/risk-level.ts` — pure functions, ideal for unit tests
- `src/lib/calculations/metrics.ts` — pure functions
- `src/lib/csv-utils.ts` — utility functions
- All context providers (`src/contexts/`)
- All API routes (`src/app/api/`)
- All React components (`src/components/`)

The project compensates with E2E tests (accessibility + UX) and a custom API health check script, but unit-level business logic is largely untested.

---

*Testing analysis: 2026-02-26*
