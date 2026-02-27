# CS12 — Multi-Tenant Workspace Architecture

## What This Is

CS12 is a customer success tracking platform for dental service organizations (DSOs). It tracks doctor onboarding progress, cases, courses, activities, and risk levels across multiple DSO workspaces. Currently live at cs12.allsolutions.consulting with real users (Alan, Claudia). This milestone adds organization-level multi-tenancy (Option 1: single org, assign DSOs to members). One organization owns DSOs, admin invites team members and assigns them to specific DSOs. CS agents manage DSO portfolios within their org and can collaborate/cover for each other. Follows MakerKit pattern.

## Core Value

A team of customer success agents can manage a portfolio of DSOs within one organization, with admins controlling who has access to which DSOs.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- ✓ User can sign up with email/password or Google OAuth — existing
- ✓ User session persists across browser refresh — existing
- ✓ Multiple DSO workspaces exist with role-based access (admin/manager/viewer) — existing
- ✓ Users see only DSOs they have access to via `user_dso_access` — existing
- ✓ Dashboard shows client overview with doctor counts, risk levels, progress — existing
- ✓ Doctor tracking with 12-period onboarding progress, activities, risk levels — existing
- ✓ Flexible data tables system (Notion-style, 16 column types, time tracking) — existing
- ✓ Team invite flow (email invite, accept, auto-grant access) — existing
- ✓ Activity logging (phone, email, text) per doctor — existing
- ✓ Search across doctors, activities, attendees — existing
- ✓ Custom terminology per workspace — existing
- ✓ CSV import for attendee lists — existing
- ✓ Executive dashboard with configurable overview widgets — existing

### Active

<!-- Current scope — the multi-tenant workspace architecture. -->

- [ ] Organizations table replaces flat DSO sharing — each workspace belongs to an organization
- [ ] User can create a new organization (auto-created on first signup)
- [ ] User can invite others to their specific organization (not all their DSOs)
- [ ] Invited user joins only the inviter's organization, not all their workspaces
- [ ] Organization switcher in the UI — user can switch between orgs they belong to
- [ ] Organization-level roles (owner, admin, member) separate from DSO-level roles
- [ ] User who signs up without an invite gets their own empty organization
- [ ] Organization owner can later request to join another user's organization
- [ ] All existing DSOs are migrated under a default organization for current users
- [ ] Existing `user_dso_access` works within organization context (DSOs belong to an org)
- [ ] Supabase RLS policies updated for organization-scoped data access
- [ ] All API routes enforce organization context alongside DSO access
- [ ] Frontend components pass organization context in all data fetches

### Out of Scope

- Cross-organization data sharing (DSOs belong to one org only) — complexity, not needed now
- Billing per organization — no monetization yet
- Organization-level settings/branding — keep it simple for now
- Auto-posting or AI features — disabled, separate concern
- Mobile app — web-first
- Real-time collaboration — not needed for this use case

## Context

- **Live production**: cs12.allsolutions.consulting on Vercel, Supabase cloud (vekxzuupejmitvwwokrf)
- **Current users**: Alan (owner, all 5 DSOs), Claudia (admin, all 5 DSOs), Valentina (erroneously has access — needs cleanup)
- **5 existing DSOs**: NADG, 7to7 Dental Group, Smile Partners USA (x2 duplicate), Pure Smiles
- **Auth workaround**: `user_id` query param fallback exists because Supabase SSR cookies weren't syncing on production. `createBrowserClient` fix deployed but fallback remains.
- **Research completed**: Studied Linear, Slack, Notion, Asana, ClickUp, Monday.com workspace models. Also reviewed MakerKit boilerplate, Clerk.dev, WorkOS patterns. Linear model (one account, multiple orgs, org switcher) chosen as best fit.
- **Key insight from research**: MakerKit (Next.js + Supabase SaaS boilerplate) has a proven pattern for this — `organizations` table, `organization_members` join table, org slug in URL, Supabase RLS policies scoped to org membership.

## Constraints

- **Tech stack**: Must stay on Next.js App Router + Supabase + TypeScript — no stack changes
- **Zero downtime**: Existing users (Alan, Claudia) must not lose access during migration
- **Backward compatible**: All existing DSO data, doctor records, activities must remain intact
- **No new services**: No additional auth providers, no new databases — work within current Supabase project
- **Cookie auth priority**: New org-scoped routes should use proper session auth, not `user_id` fallback

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Linear model (one account, multiple orgs) | Best fit for "I have my workspace, you have yours, I can invite you to mine" | — Pending |
| MakerKit-style implementation | Proven Supabase + Next.js pattern, org slug in URL, RLS policies | — Pending |
| Migration-first approach | Existing data must move cleanly to new org structure before new features work | — Pending |
| Organization auto-creation on signup | New users get an empty org immediately — no onboarding friction | — Pending |

---
*Last updated: 2026-02-26 after initialization*
