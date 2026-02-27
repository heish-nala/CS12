# Phase 3: Invite System — Research

**Researched:** 2026-02-27
**Domain:** Supabase org-scoped invites — fixing an existing DSO-scope bug, building an org-scoped `org_invites` table, email delivery via `inviteUserByEmail`, and an `/auth/confirm` callback route for Next.js App Router
**Confidence:** HIGH

---

## Summary

Phase 3 has two distinct, sequenced jobs: (1) fix the existing invite bug that grants the invitee access to ALL of the inviter's DSOs, and (2) build a new org-scoped invite system that inserts the invitee into `org_members` for the correct org only.

The existing bug is in two places. `POST /api/team/invite` intentionally fetches `inviterAccess` (all DSOs the inviter has) and grants them all to the invitee. `POST /api/team/accept-invite` does the same — it looks up `invite.invited_by` and grants the new user every DSO that inviter has. Both paths must be rewritten. The `team_invites` table is already DSO-scoped (it has a `dso_id` column), so the bug is purely in application logic, not schema.

The new invite system needs a new `org_invites` table (org-scoped, not DSO-scoped), a new `POST /api/orgs/[id]/invites` endpoint that calls `supabaseAdmin.auth.admin.inviteUserByEmail`, and an `/app/auth/confirm/route.ts` callback that handles the `token_hash + type=invite` flow. The invite acceptance path: user clicks email link → lands at `/auth/confirm` → `verifyOtp({ type: 'invite', token_hash })` establishes their session → redirect to `/` → `auth-context.tsx` fires `SIGNED_IN` event → existing `checkAndAcceptInvites` or a new `checkAndAcceptOrgInvites` function inserts them into `org_members`.

The most important planning decision: Phase 3 is building the new org-scoped system. The existing `team_invites` / `/api/team/invite` routes are old-model DSO-level invite machinery. The bug fix isolates their damage (scope them to only the specific `dso_id` on the invite). But the new org-scoped invite system uses a separate table (`org_invites`) and a separate API route group (`/api/orgs/[id]/invites`). The old and new systems run in parallel until Phase 5 deprecates the old model.

**Primary recommendation:** Fix the existing bug first (2 targeted code edits to accept-invite and invite POST routes), then build org_invites as a completely separate subsystem. Do not retrofit team_invites into an org-scoped table — the schemas and flows are different enough that a new table is cleaner.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.86.0 | `supabaseAdmin.auth.admin.inviteUserByEmail`, DB inserts via `supabaseAdmin.from(...)` | Already used across all routes — no change |
| `@supabase/ssr` | ^0.8.0 | `createServerClient` for the `/auth/confirm` route handler (session cookie handling) | Required for server-side auth in App Router |
| `next` | ^16.0.7 | Route Handler in `app/auth/confirm/route.ts` for token verification | Already the framework |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `crypto.randomUUID()` | Node built-in | Generating secure invite tokens if needed for non-Supabase-auth paths | Only if building custom token flow |
| Supabase CLI | 2.75.0 | Migration for `org_invites` table | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `inviteUserByEmail` for email delivery | Custom email via Resend/SendGrid + `generateLink('invite')` | `inviteUserByEmail` is the simplest path — one call handles user creation + email. Custom email required only if Supabase email delivery is unreliable or custom templates are needed. |
| New `org_invites` table | Re-use existing `team_invites` with `org_id` column | `team_invites` is DSO-scoped (`dso_id NOT NULL`). Adding `org_id` would create a mixed-purpose table with nullable columns. Separate table is cleaner. |
| `/auth/confirm` GET route handler | Client-side `verifyOtp` in login page | Server-side route is the official Supabase pattern for App Router. PKCE is not supported for invite links, so client-side-only handling works — but the server route is more robust and handles cookie setting correctly. |

**Installation:**
```bash
# No new packages required — existing stack covers everything
```

---

## Architecture Patterns

### Recommended Project Structure

New files to create in Phase 3:

```
src/
├── app/
│   ├── auth/
│   │   └── confirm/
│   │       └── route.ts          # NEW: GET handler for token_hash + type=invite
│   └── api/
│       └── orgs/
│           └── [id]/
│               └── invites/
│                   └── route.ts  # NEW: POST (send invite), GET (list), DELETE (cancel)
supabase/
└── migrations/
    └── 20260227XXXXXX_add_org_invites.sql   # NEW: org_invites table
```

Existing files to modify:

```
src/
└── app/api/team/
    ├── invite/route.ts            # FIX: remove "all inviter's DSOs" logic
    └── accept-invite/route.ts     # FIX: remove "all inviter's DSOs" logic
```

Also update (to accept org invites on sign-in):

```
src/
└── contexts/
    └── auth-context.tsx           # UPDATE: call new /api/orgs/accept-invite on SIGNED_IN
```

### Pattern 1: The Existing Invite Bug — Exact Lines to Fix

**What goes wrong:** Both the invite sender and invite acceptor paths deliberately expand the scope beyond the intended DSO/org. The fix is to remove the scope-expansion and use only the scoped identifier.

**Bug location 1 — `POST /api/team/invite` (lines 88–150):**

The "existing user" branch fetches `inviterAccess` (ALL DSOs the inviter has) and grants them all to the invitee. The fix: grant only the single `dso_id` from the request body.

```typescript
// BEFORE (buggy — grants all inviter's DSOs):
const { data: inviterAccess } = await supabaseAdmin
    .from('user_dso_access')
    .select('dso_id')
    .eq('user_id', currentUser.id);
const inviterDsoIds = inviterAccess?.map(a => a.dso_id) || [dso_id];
// then inserts all inviterDsoIds for the existing user

// AFTER (fixed — grant only the requested DSO):
const insertRows = [{ user_id: existingUser.id, dso_id: dso_id, role: role }];
const { error: accessError } = await supabaseAdmin
    .from('user_dso_access')
    .insert(insertRows)
    .throwOnError();
// Also remove the "missingDsoIds" filter logic — it's no longer needed
```

**Bug location 2 — `POST /api/team/accept-invite` (lines 66–101):**

The loop over `pendingInvites` fetches `inviterAccess` and grants ALL of the inviter's DSOs. The fix: grant only `invite.dso_id`.

```typescript
// BEFORE (buggy — grants all of inviter's DSOs):
const { data: inviterAccess } = await supabaseAdmin
    .from('user_dso_access')
    .select('dso_id')
    .eq('user_id', invite.invited_by);
const allDsoIds = inviterAccess?.map(a => a.dso_id) || [invite.dso_id];

// AFTER (fixed — grant only the invite's DSO):
const { error: accessError } = await supabaseAdmin
    .from('user_dso_access')
    .insert({ user_id: actualUserId, dso_id: invite.dso_id, role: invite.role })
    .throwOnError();
// Remove the existingAccess / missingDsoIds logic entirely
```

### Pattern 2: org_invites Table Schema

**What:** A new table storing org-scoped invite records. Scoped to `org_id` (not `dso_id`). Separate from the legacy `team_invites` table.

```sql
-- Source: modeled on existing team_invites + Phase 1/2 migration patterns

CREATE TABLE org_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, email, status)  -- one pending invite per email per org
);

CREATE INDEX idx_org_invites_org_id ON org_invites(org_id);
CREATE INDEX idx_org_invites_email ON org_invites(email);
CREATE INDEX idx_org_invites_status ON org_invites(status);
```

**Key difference from `team_invites`:** Uses `org_id` (references `organizations`), not `dso_id` (references `dsos`). Role values are `owner/admin/member` (org roles from Phase 2), not `admin/manager/viewer` (DSO access roles). Both tables stay in place during the transition period.

### Pattern 3: Invite Send API — `POST /api/orgs/[id]/invites`

**What:** New endpoint that (1) requires org owner/admin, (2) creates an `org_invites` row, (3) calls `inviteUserByEmail` for new users or adds existing users directly to `org_members`.

**When to use:** Admin invites someone to join the org.

**Key behaviors:**
- If the email belongs to a Supabase user who is NOT already in the org: call `inviteUserByEmail` and create an `org_invites` row.
- If the email belongs to a Supabase user who IS already in the org: return 409.
- If the email belongs to a Supabase user who is NOT yet in this org: consider adding them directly to `org_members` without an email invite (same pattern as current `team_invites` "existing user" fast path). This avoids sending an invite email to someone who already has an account.
- If the email belongs to NO existing user: call `inviteUserByEmail`, store the invite in `org_invites`.

**Important `inviteUserByEmail` constraint:** If the email is already registered in Supabase auth.users, `inviteUserByEmail` returns an error — it cannot re-invite registered users. Handle this as a branch: registered users get added to `org_members` directly (no email), unregistered users get an email invite.

```typescript
// Source: Pattern derived from existing /api/team/invite + supabase inviteUserByEmail docs

// POST /api/orgs/[id]/invites
export async function POST(request: NextRequest, { params }: ...) {
    const { id: orgId } = await params;

    const authResult = await requireOrgAccess(request, orgId, true);  // owner/admin only
    if ('response' in authResult) return authResult.response;
    const { user } = authResult;

    const { email, role = 'member' } = await request.json();
    // ... validate email, role ...

    // Check if user already exists in auth.users via user_profiles (avoid listUsers())
    const { data: existingProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .single();

    if (existingProfile) {
        // Check if already an org member
        const { data: existingMember } = await supabaseAdmin
            .from('org_members')
            .select('id')
            .eq('org_id', orgId)
            .eq('user_id', existingProfile.id)
            .single();

        if (existingMember) {
            return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
        }

        // Add directly to org_members (no email needed — they already have an account)
        await supabaseAdmin
            .from('org_members')
            .insert({ org_id: orgId, user_id: existingProfile.id, role });

        return NextResponse.json({ success: true, added_directly: true });
    }

    // New user — create invite record + send email
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { data: invite, error: inviteError } = await supabaseAdmin
        .from('org_invites')
        .insert({ org_id: orgId, email: normalizedEmail, role, invited_by: user.id, expires_at: expiresAt })
        .select()
        .single();

    if (inviteError) { /* 409 on duplicate */ }

    const { error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
            data: { org_id: orgId, invite_id: invite.id, role },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/`,
        }
    );

    if (authError) {
        // Rollback invite row
        await supabaseAdmin.from('org_invites').delete().eq('id', invite.id);
        return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
    }

    return NextResponse.json({ success: true, invite });
}
```

### Pattern 4: Auth Confirm Route Handler — `/app/auth/confirm/route.ts`

**What:** The critical missing piece this codebase does not have. When `inviteUserByEmail` sends an email, the link contains `token_hash` and `type=invite`. Supabase redirects to `redirectTo` with those params appended. Without a route handler at that URL, the invite link just lands on the login page with dangling query params and no session is established.

**This is the most important new file in Phase 3.**

```typescript
// Source: Supabase official SSR+App Router invite pattern
// File: src/app/auth/confirm/route.ts

import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;
    const next = searchParams.get('next') ?? '/';

    if (token_hash && type) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    },
                },
            }
        );

        const { error } = await supabase.auth.verifyOtp({ type, token_hash });

        if (!error) {
            // Session is now established — redirect to app
            // auth-context.tsx will fire SIGNED_IN → checkAndAcceptOrgInvites
            return NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', request.url));
        }
    }

    return NextResponse.redirect(new URL('/login?error=invalid_invite', request.url));
}
```

**Note on PKCE:** `inviteUserByEmail` does NOT use PKCE (confirmed in Supabase docs). Therefore the confirm route does not need to exchange a code — `verifyOtp` with `token_hash` is the correct path.

### Pattern 5: Invite Acceptance in auth-context.tsx

**What:** After the user lands at `/auth/confirm`, their session is established and `auth-context.tsx` fires the `SIGNED_IN` event. The existing `checkAndAcceptInvites` function handles old `team_invites`. Phase 3 adds a parallel function `checkAndAcceptOrgInvites` that processes pending `org_invites`.

```typescript
// Add to auth-context.tsx alongside existing checkAndAcceptInvites

async function checkAndAcceptOrgInvites(userId: string, email: string) {
    try {
        const response = await fetch('/api/orgs/accept-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, email }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data.accepted_count > 0) {
                console.log(`Joined ${data.accepted_count} org(s):`, data.orgs);
            }
        }
    } catch (error) {
        console.error('Error accepting org invites:', error);
    }
}
```

**Note on new `POST /api/orgs/accept-invite` endpoint:** This endpoint queries `org_invites` by email (not by org_id), marks matching pending non-expired invites as accepted, and inserts the user into `org_members`. It is analogous to the existing `/api/team/accept-invite`.

### Anti-Patterns to Avoid

- **Do NOT call `listUsers()` to check if an email is registered.** It fetches all users. Use `user_profiles` table which was built in Phase 2 precisely to avoid this. Query `user_profiles` by email instead.
- **Do NOT embed the invite token in the redirectTo URL manually.** Supabase appends `token_hash` and `type` to the `redirectTo` automatically — just set `redirectTo` to `${APP_URL}/auth/confirm`.
- **Do NOT use PKCE for invite flows.** Supabase explicitly states PKCE is not supported for `inviteUserByEmail`. The confirm route must use `verifyOtp` not `exchangeCodeForSession`.
- **Do NOT try to send a second `inviteUserByEmail` to a user who is already registered** — it returns an error. Handle registered vs. unregistered users as separate branches.
- **Do NOT delete `team_invites` or `/api/team/invite` in Phase 3.** Phase 5 will deprecate the old model. Phase 3 only fixes the bug in the old system and builds the new system alongside it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sending invite email | Custom SMTP setup | `supabaseAdmin.auth.admin.inviteUserByEmail` | Already in the stack, works with Supabase's auth flow, handles user creation |
| Secure invite token | UUID + custom storage | Supabase's built-in `token_hash` flow via `inviteUserByEmail` + `verifyOtp` | Supabase handles token generation, expiry, one-time use |
| Auth session from invite link | Manual token parsing | `supabase.auth.verifyOtp({ type: 'invite', token_hash })` | Official Supabase App Router pattern |
| Checking if user exists by email | `auth.admin.listUsers()` | `user_profiles` table query by email | `listUsers()` fetches all users — N+1 at scale. `user_profiles` was added in Phase 1 for exactly this purpose |

**Key insight:** The existing codebase already uses `inviteUserByEmail` for DSO-level invites (in `/api/team/invite`). Phase 3 reuses the same Supabase mechanism for org-level invites. The token handling infrastructure is the same — only the callback route and the table being populated differ.

---

## Common Pitfalls

### Pitfall 1: No /auth/confirm Route = Broken Invite Links

**What goes wrong:** `inviteUserByEmail` sends an email with a link containing `token_hash` and `type=invite`. The current codebase has no `/auth/confirm` route handler. Without it, users who click the invite link land on the login page with unprocessed query params — no session is established, and the invite is never accepted.

**Why it happens:** The existing `/api/team/invite` flow works "accidentally" because it uses `redirectTo: /login?invited=true` and then `auth-context.tsx` calls `checkAndAcceptInvites` on SIGNED_IN. But `SIGNED_IN` only fires after the user explicitly signs in — it does NOT fire from clicking an invite link without a confirm route. The invite link never creates a session.

**How to avoid:** Create `src/app/auth/confirm/route.ts` as Pattern 4 describes. Also verify in Supabase Dashboard > URL Configuration that `${APP_URL}/auth/confirm` is in the allowed redirect URLs list.

**Warning signs:** User reports "I clicked the link but nothing happened" — they landed on `/login` with dangling `?token_hash=...` params.

### Pitfall 2: inviteUserByEmail Silently Fails for Existing Users

**What goes wrong:** Calling `inviteUserByEmail` for an email that already has a Supabase auth.users row returns an error. The error message is not always clear. The user never receives an email, and the `org_invites` row was just inserted.

**Why it happens:** Supabase treats `inviteUserByEmail` as a user creation flow. If the user already exists, it cannot create them again.

**How to avoid:** Before calling `inviteUserByEmail`, check `user_profiles` by email. If found: add them directly to `org_members` (no email needed). If not found: proceed with `inviteUserByEmail`. This is the same branch logic already in `/api/team/invite`.

**Warning signs:** `inviteUserByEmail` returns `authError.message` containing "user already registered" or "email exists".

### Pitfall 3: UNIQUE Constraint Conflict on org_invites

**What goes wrong:** `UNIQUE(org_id, email, status)` means a second invite to the same email for the same org while the first is still `pending` will fail with a 23505 error.

**Why it happens:** The unique constraint is correct behavior — you don't want two pending invites. But the API must handle this gracefully with a 409 response, not a 500.

**How to avoid:** Check for `error.code === '23505'` before returning the error, and return `{ error: 'A pending invite already exists for this email', status: 409 }`.

### Pitfall 4: Invite Accepted Before Account Signup Trigger Fires

**What goes wrong:** The Phase 2 signup trigger (`handle_new_user_signup`) creates an org for NEW users on `auth.users INSERT`. An invited user also triggers this — they get their own empty org PLUS are added to the inviter's org. This is correct behavior (they have their own org as owner, plus belong to the inviter's org as member). But if the trigger fails, the accept-invite flow may succeed while leaving the user without their own org.

**Why it happens:** Trigger and application-level code execute in the same transaction boundary for the user creation, but the accept-invite fetch in `auth-context.tsx` is a separate async call after `SIGNED_IN`.

**How to avoid:** The trigger is SECURITY DEFINER and runs as postgres — it should be reliable. No special handling needed. Document the two-org-on-first-invite expected state.

### Pitfall 5: Redirect URL Not Whitelisted

**What goes wrong:** Supabase rejects `redirectTo` values that are not whitelisted in the Dashboard under Authentication > URL Configuration. If `/auth/confirm` is not whitelisted, `inviteUserByEmail` either ignores the `redirectTo` and sends the default link (pointing at Site URL) or returns an error.

**Why it happens:** Supabase validates redirect URLs against a whitelist for security.

**How to avoid:** After writing the confirm route, verify in Supabase Dashboard that `${APP_URL}/auth/confirm` is in the allowed list. For production: `https://[production-url]/auth/confirm`. For local: already covered by `additional_redirect_urls = ["http://localhost:3000"]` in `supabase/config.toml` — but need to also add `http://localhost:3000/auth/confirm`.

---

## Code Examples

### Creating org_invites Migration

```sql
-- Source: supabase/migrations/20260227XXXXXX_add_org_invites.sql
-- Models: existing team_invites + org_members patterns from Phase 1/2

CREATE TABLE org_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, email, status)
);

CREATE INDEX idx_org_invites_org_id ON org_invites(org_id);
CREATE INDEX idx_org_invites_email ON org_invites(email);
CREATE INDEX idx_org_invites_status ON org_invites(status);
```

### Accept Org Invites on Login

```typescript
// Source: Pattern from existing auth-context.tsx checkAndAcceptInvites
// New: POST /api/orgs/accept-invite route

export async function POST(request: NextRequest) {
    const { user_id, email } = await request.json();

    const normalizedEmail = email.toLowerCase().trim();

    const { data: pendingInvites } = await supabaseAdmin
        .from('org_invites')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

    if (!pendingInvites?.length) {
        return NextResponse.json({ success: true, accepted_count: 0 });
    }

    let acceptedCount = 0;
    const orgs: string[] = [];

    for (const invite of pendingInvites) {
        // Insert into org_members (ON CONFLICT DO NOTHING — idempotent)
        const { error: memberError } = await supabaseAdmin
            .from('org_members')
            .insert({ org_id: invite.org_id, user_id, role: invite.role })
            // Cannot use ON CONFLICT here — use upsert or check first
            ;

        if (!memberError) {
            // Also ensure user_profiles row exists (may have been created by signup trigger)
            await supabaseAdmin
                .from('user_profiles')
                .upsert({ id: user_id, email: normalizedEmail }, { onConflict: 'id', ignoreDuplicates: true });

            await supabaseAdmin
                .from('org_invites')
                .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                .eq('id', invite.id);

            acceptedCount++;

            const { data: org } = await supabaseAdmin
                .from('organizations')
                .select('name')
                .eq('id', invite.org_id)
                .single();
            if (org) orgs.push(org.name);
        }
    }

    return NextResponse.json({ success: true, accepted_count: acceptedCount, orgs });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Invite accepted grants all inviter's DSOs | Invite accepted grants only invited DSO/org | Phase 3 (this phase) | Closes ISO-04 cross-org data leak risk |
| No `/auth/confirm` route | `/auth/confirm` route handles `token_hash` + `type=invite` | Phase 3 (this phase) | Invite links actually work end-to-end |
| DSO-scoped invites via `team_invites` | Org-scoped invites via `org_invites` | Phase 3 (this phase) | Isolation correct at org level |

**Deprecated/outdated:**
- The "all inviter's DSOs" logic in `/api/team/invite` and `/api/team/accept-invite`: fixed in Phase 3 (still kept, just corrected)
- Using `auth.admin.listUsers()` to check existing users: the `user_profiles` table from Phase 1 replaces this

---

## Open Questions

1. **Should existing-user invites add them to `org_members` directly (silently) or send a notification email?**
   - What we know: Current `team_invites` fast-path adds them directly with no email. Supabase cannot send an invite email to existing users via `inviteUserByEmail`.
   - What's unclear: Whether Alan wants existing users to receive any email notification when added to an org.
   - Recommendation: Add directly to `org_members` without email (matching existing pattern). If a notification email is desired, that requires a custom email provider (Resend/SendGrid) — out of scope for Phase 3.

2. **Should `POST /api/orgs/[id]/invites` also store `user_id` on the `org_invites` row when the inviter knows the user_id?**
   - What we know: `invited_by` (the sender) is stored. The invitee's UUID is unknown until they accept.
   - What's unclear: Whether a `user_id` column (nullable) on `org_invites` is useful for linking after acceptance.
   - Recommendation: Omit it from the schema. The accept-invite flow looks up by email, not user_id. Adding a nullable `user_id` would need updating on acceptance — extra complexity for no clear benefit.

3. **Does the existing `/api/team/accept-invite` also need to handle org_invites, or should `/api/orgs/accept-invite` be a separate endpoint?**
   - What we know: `auth-context.tsx` already calls `checkAndAcceptInvites` (hits `/api/team/accept-invite`). Adding org invite acceptance there would mix DSO and org concerns in one endpoint.
   - Recommendation: Create a separate `/api/orgs/accept-invite` endpoint, and add a separate `checkAndAcceptOrgInvites` call in `auth-context.tsx` alongside the existing call.

---

## Sources

### Primary (HIGH confidence)

- `src/app/api/team/invite/route.ts` — exact lines of the invite bug
- `src/app/api/team/accept-invite/route.ts` — exact lines of the accept-invite bug
- `supabase/migrations/20250115_add_team_invites.sql` — existing `team_invites` schema
- `supabase/migrations/20260226000000_add_org_tables.sql` — `organizations`, `org_members` schema
- `supabase/migrations/20260227000001_org_signup_trigger.sql` — signup trigger pattern
- `src/lib/auth.ts` — `requireOrgAccess`, `checkOrgMembership` helpers (available for Phase 3 use)
- `src/contexts/auth-context.tsx` — how `SIGNED_IN` fires `checkAndAcceptInvites`
- [Supabase inviteUserByEmail docs](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) — PKCE not supported, `data` param, `redirectTo` param

### Secondary (MEDIUM confidence)

- [Supabase discussion #6055 — team member invites](https://github.com/supabase/supabase/discussions/6055) — "build your own for multi-tenant"
- [Supabase Auth Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) — `{{ .ConfirmationURL }}`, `{{ .Data }}` variables
- WebSearch: `inviteUserByEmail` fails for existing users — confirmed behavior, must handle as separate branch
- WebSearch: `token_hash + type=invite` pattern with App Router — confirms `verifyOtp` is the correct accept path, not `exchangeCodeForSession`

### Tertiary (LOW confidence)

- Community patterns for org_invites table design — conceptually aligned, not from official Supabase docs

---

## Metadata

**Confidence breakdown:**
- Bug fix (what to change): HIGH — code is fully readable, bug is explicit at lines 88–150 of invite/route.ts and lines 66–101 of accept-invite/route.ts
- Standard stack: HIGH — same `supabaseAdmin` + Next.js pattern as all prior phases
- Architecture: HIGH — org_invites schema modeled on team_invites + org_members patterns already in codebase
- `/auth/confirm` route: HIGH — official Supabase App Router pattern; `verifyOtp` is correct for invite type
- `inviteUserByEmail` behavior for existing users: HIGH — confirmed from multiple sources
- Pitfalls: HIGH — derived directly from codebase reading + official docs

**Research date:** 2026-02-27
**Valid until:** 2026-03-28 (30 days — stable APIs)
