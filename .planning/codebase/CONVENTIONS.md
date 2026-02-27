# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- React components: kebab-case with `.tsx` extension — `create-client-dialog.tsx`, `doctor-tracker.tsx`
- API routes: Next.js convention `route.ts` inside `[method]/` directories
- Utility/lib files: kebab-case `.ts` — `api-monitor.ts`, `csv-utils.ts`, `risk-level.ts`
- Context files: kebab-case with `-context` suffix — `auth-context.tsx`, `clients-context.tsx`
- Type files: `types.ts` inside domain directories — `src/lib/db/types.ts`

**Functions:**
- camelCase for all functions — `calculateRiskLevel`, `getDaysSinceActivity`, `withMonitoring`
- React components: PascalCase — `CreateClientDialog`, `DoctorTracker`, `AuthProvider`
- Event handlers: `handle` prefix — `handleSubmit`, `handleChange`
- Context hooks: `use` prefix — `useAuth`, `useClients`, `useMetricConfigOrDefault`
- Auth helpers: verb phrases — `requireAuth`, `requireDsoAccess`, `getAuthUser`, `checkDsoAccess`

**Variables:**
- camelCase — `clientId`, `dsoId`, `enrichedDoctors`, `metricsBuffer`
- Boolean flags: descriptive names — `loading`, `hasAccess`, `requireWrite`, `inviteCheckDone`

**Types and Interfaces:**
- PascalCase for interfaces — `AuthContextType`, `DoctorTrackerProps`, `CreateClientDialogProps`
- PascalCase for type aliases — `RiskLevel`, `DoctorStatus`, `ActivityType`, `ColumnType`
- Union string literals for enums: `'low' | 'medium' | 'high' | 'critical'`
- Extended types use `With` suffix — `DoctorWithDSO`, `DoctorWithMetrics`, `DataTableWithColumns`
- Response types use `Response` suffix — `DoctorListResponse`, `AuthResult`

**Database/API fields:**
- snake_case for all database field names — `dso_id`, `contact_name`, `order_index`, `created_at`
- API route parameters: snake_case — `client_id`, `user_id`, `template_id`

## Code Style

**Formatting:**
- 4-space indentation (consistent throughout src/)
- Single quotes for string literals in `.ts`/`.tsx` files
- Double quotes in configuration files (JSON, some config `.mjs` files)
- Trailing commas in multi-line objects and arrays
- No Prettier config detected — formatting is manual/editor-enforced

**Linting:**
- ESLint 9 with `eslint-config-next` (core-web-vitals + typescript presets)
- `@typescript-eslint/no-explicit-any`: OFF — `any` types are used freely, often with `eslint-disable` comments
- `@typescript-eslint/no-unused-vars`: WARN
- `react-hooks/exhaustive-deps`: WARN (some intentional eslint-disable comments)
- `prefer-const`: WARN
- Config: `eslint.config.mjs`

**TypeScript:**
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- Path alias `@/*` maps to `./src/*` — used consistently throughout
- `any` is used in several places despite strict mode (ESLint rule is off)

## Import Organization

**Order observed in component files:**
1. React core — `import { useState } from 'react'`
2. Next.js — `import { useRouter } from 'next/navigation'`
3. Internal UI components (`@/components/ui/...`) — Button, Dialog, Input, Label
4. External UI libraries — `toast` from `sonner`, icons from `lucide-react`
5. Internal contexts — `@/contexts/auth-context`
6. Internal lib/utilities — `@/lib/...`

**Order observed in API route files:**
1. Next.js server — `import { NextRequest, NextResponse } from 'next/server'`
2. Database client — `import { supabase } from '@/lib/db/client'`
3. Business logic — `import { calculateRiskLevel } from '@/lib/calculations/...'`
4. Auth helpers — `import { requireAuth } from '@/lib/auth'`

**Path Aliases:**
- Always use `@/` alias instead of relative paths — no `../../` patterns

## Error Handling

**API Routes — standard pattern:**
```typescript
export async function GET(request: NextRequest) {
    try {
        // auth check returns early if fails
        const authResult = await requireAuth(request);
        if ('response' in authResult) {
            return authResult.response;  // returns 401/403
        }

        // business logic
        const { data, error } = await supabase.from('...').select('...');
        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error [description]:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
```

**Input validation — early return before auth in some routes:**
```typescript
if (!client_id) {
    return NextResponse.json(
        { error: 'client_id is required' },
        { status: 400 }
    );
}
```

**Client-side components — try/catch with toast:**
```typescript
try {
    const response = await fetch('/api/...');
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to create client');
    }
    toast.success('Client created successfully');
} catch (error) {
    console.error('Error creating client:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to create client');
} finally {
    setLoading(false);
}
```

**Error discrimination:** `error instanceof Error ? error.message : 'Fallback message'`

## Logging

**Framework:** `console` (no external logging library)

**Patterns:**
- API route errors: `console.error('Error [verb]ing [noun]:', error)` — used in every catch block
- Slow API queries: `console.warn('[SLOW API] ...')` via `withMonitoring()` wrapper in `src/lib/api-monitor.ts`
- Dev-only API timing: `console.log('[API] ...')` gated by `process.env.NODE_ENV === 'development'`
- Debug/info in context hooks: `console.log(...)` for auth events
- Total: ~140 console calls across 61 files

## Comments

**When to Comment:**
- Complex business logic gets a doc block explaining the algorithm (see `src/lib/calculations/risk-level.ts`)
- Auth helper functions use JSDoc with description + `Usage:` example (see `src/lib/api-monitor.ts`)
- Data relationships that are non-obvious get inline comments (`// Row data keyed by COLUMN ID, NOT column name`)
- Database schema groupings use section dividers: `// ============================================================`

**JSDoc/TSDoc:**
- Used sparingly — primarily on exported lib functions, not on React components
- Pattern: description paragraph, then `Usage:` example with code block

## Function Design

**Size:** Functions are typically medium-length (20-80 lines). Large API route handlers (100-200 lines) are common and not broken up.

**Parameters:** Interfaces defined for all React component props — `interface XxxProps { ... }`

**Return Values:**
- API auth helpers use discriminated union returns:
  `{ user: AuthUser; response?: never } | { user?: never; response: NextResponse }`
- Callers check with `if ('response' in authResult)` pattern
- React hooks return state objects, not arrays (exception: standard React hooks)

## Component Design

**'use client' directive:** Present at top of all client-side components and context files — required for Next.js App Router.

**Props pattern:**
```typescript
interface ComponentNameProps {
    propName: type;
    onCallback: (param: type) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;  // Dialog control
}

export function ComponentName({ prop1, prop2 }: ComponentNameProps) { ... }
```

**Dialog components:** All dialogs receive `open: boolean` + `onOpenChange: (open: boolean) => void` — consistent with shadcn/ui `Dialog` pattern.

**Performance:** `memo()` used on table row components with many props — `src/components/doctors/doctor-tracker.tsx` uses `const DoctorRow = memo(function DoctorRow(...))`.

## Module Design

**Exports:**
- Named exports only — no default exports for components (exception: Next.js pages use default export)
- Barrel files used for complex modules: `src/components/onboarding/index.ts` re-exports all public items

**Barrel Files:**
- Used selectively for module boundaries (onboarding module), not for every directory
- Pattern: explicit named exports + type re-exports

## Data Attributes

**Onboarding/testing hooks:** `data-onboarding="..."` attributes placed on key UI elements for tour targeting — e.g., `data-onboarding="create-client-dialog"`.

---

*Convention analysis: 2026-02-26*
