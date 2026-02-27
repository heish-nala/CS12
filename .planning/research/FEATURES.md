# Feature Research

**Domain:** Multi-tenant SaaS workspace / organization management
**Context:** CS12 — dental DSO management platform, adding organization layer over existing flat `user_dso_access` model
**Researched:** 2026-02-26
**Confidence:** HIGH (cross-verified across multiple authoritative sources + code inspection)

---

## What Already Exists in CS12

Before categorizing features, it is important to map what is already built. This directly shapes what is "new work" vs "wire up existing plumbing."

| Area | Status | Details |
|------|--------|---------|
| Invitation send | BUILT | `POST /api/team/invite` — sends Supabase magic link, stores in `team_invites` table with 7-day expiry |
| Invitation cancel | BUILT | `DELETE /api/team/invite` — admin only |
| Pending invite list | BUILT | `GET /api/team/invite` — shows active non-expired invites for a DSO |
| Auto-accept on login | BUILT | `auth-context.tsx` calls `POST /api/team/accept-invite` on every sign-in |
| DSO switching | BUILT | `DSOSwitcher` component — URL param based (`?dso_id=`), shows all DSOs user has access to |
| Roles: admin/manager/viewer | BUILT | `user_dso_access.role` enforced across API routes |
| Write vs read access | BUILT | `hasWriteAccess()` checks admin or manager role |
| Admin gate on invite ops | BUILT | Only admins can send/cancel/view invites |
| Team member list | BUILT (partial) | `GET /api/team` returns members — but "best role across all workspaces" logic is a simplification |
| Self-invite prevention | BUILT | Checked in invite route |
| Already-a-member detection | BUILT | Checks existing access before sending invite |

**Key gap identified from code inspection:** The current model treats DSOs as the workspace unit. The new milestone adds an `organizations` table as the top-level container for one or more DSOs. This means multi-tenancy currently exists at the DSO level — the milestone lifts it one level up.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any multi-tenant workspace system. Missing these = product feels broken.

| Feature | Why Expected | Complexity | Already Built? | Notes |
|---------|--------------|------------|----------------|-------|
| Create an organization | Every multi-tenant app has org creation as the entry point | LOW | NO | Currently orgs don't exist as a DB concept; DSOs are the tenant unit |
| Invite members by email | Standard onboarding path for all B2B SaaS | LOW | YES (DSO level) | Exists but needs to be lifted to org level |
| Accept/reject invitation | Users need to control what they join | LOW | PARTIAL | Accept auto-fires on login; no explicit reject |
| Cancel pending invite | Admins make mistakes | LOW | YES | Delete endpoint exists |
| View pending invites | Admins need visibility into who hasn't joined yet | LOW | YES | GET invite endpoint exists |
| Member list with roles | Admins must see who has access and at what level | LOW | YES (partial) | Works but role display is "best role" simplification |
| Remove a member | Offboarding is as important as onboarding | LOW | NO | No remove-member endpoint found in codebase |
| Change a member's role | Roles change as responsibilities change | LOW | NO | No role-update endpoint found |
| Org switcher UI | Users in multiple orgs need frictionless context switching | MEDIUM | YES (DSO level) | Exists as DSO switcher; needs to be org-level |
| Data isolation per org | Users must not see data from orgs they don't belong to | HIGH | YES (DSO level via RLS) | RLS is on `user_dso_access` — needs org layer |
| Roles scoped per org | Admin in org A ≠ admin in org B | MEDIUM | YES (DSO level) | Role per `user_dso_access` row, scoped to DSO |
| Prevent duplicate membership | Same user invited twice = confusion | LOW | YES | Duplicate invite check exists |
| Org name / basic profile | Orgs need a human-readable identity | LOW | YES (DSO has name) | DSO table already has name, logo fields |
| Leave an organization | Users must be able to exit orgs they no longer belong to | LOW | NO | Not found in codebase |
| Invitation expiry | Stale invites are a security concern | LOW | YES | 7-day expiry hardcoded |

---

### Differentiators (Competitive Advantage)

Features that are not universally expected but add meaningful value for CS12's specific context (dental DSO management, B2B internal tool).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Role-based onboarding path | Invited viewers see viewer-specific onboarding, not admin onboarding — reduces confusion | MEDIUM | CS12 has onboarding tour; branching per role adds real value |
| Org-scoped DSO assignment | Admin can control which DSOs inside the org a member can access (sub-org access control) | HIGH | CS12's nested structure (org > DSO > data) makes this genuinely useful |
| Invite with pre-set DSO access | When inviting, admin specifies which DSOs the invitee gets access to, not just the org | MEDIUM | Aligns with existing `dso_id` on invite record |
| Transfer org ownership | Owner can hand off control to another admin | MEDIUM | Important for long-term SaaS reliability — prevents org lock-out |
| Resend expired invite | One-click resend when 7-day window lapses | LOW | Easy win; admins currently have no way to see expired invites |
| Org activity audit log | See who invited whom, when members joined, role changes | HIGH | HIPAA-adjacent compliance; dental orgs are regulated entities |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Requested | Why Problematic | What to Do Instead |
|--------------|---------------|-----------------|-------------------|
| SSO / SAML per org | Enterprise orgs ask for it | Massive implementation scope; irrelevant for CS12's current 3-user scale | Keep Supabase email + Google OAuth; revisit at 50+ enterprise users |
| Custom roles / permission builder | Power users want fine-grained control | Creates "role explosion" — admin, manager, viewer already cover CS12's use cases | Keep the 3 fixed roles; document what each can do clearly |
| Auto-provisioning via email domain | "Anyone @acmeDSO.com joins automatically" | Creates security holes; dental staff share email domains within a DSO org | Keep explicit invite-only model |
| Org-level branding (custom logo, colors) | Nice to have for white-label feel | Scope creep; CS12 is an internal tool, not a client-facing product | One logo per org (already possible via DSO fields); skip theming engine |
| Teams within orgs | Slack-like sub-groups | Premature complexity for 5 DSOs and 3 users; adds a third hierarchy level | Org > DSO is sufficient for CS12's two-level structure |
| Notification preferences per member | Members want to control emails | Low value at current scale; increases surface area | Standard system emails only; no per-user notification settings |
| Public org profiles / discoverability | Social SaaS pattern | CS12 is invite-only by design; orgs should never be discoverable | Stay invite-only; no public directory |

---

## Feature Dependencies

```
[Create Organization]
    └──enables──> [Invite Members to Org]
                      └──enables──> [Accept Invitation]
                                        └──enables──> [Member List with Roles]

[Create Organization]
    └──enables──> [Org Switcher]
                      └──requires──> [Data Isolation per Org]

[Data Isolation per Org]
    └──requires──> [Roles scoped per Org]
                       └──enables──> [Role-Based Onboarding Path]

[Invite Members to Org]
    └──requires──> [Remove a Member]  (invitation is meaningless without ability to revoke)

[Member List with Roles]
    └──enables──> [Change a Member's Role]
    └──enables──> [Remove a Member]

[Transfer Org Ownership]
    └──requires──> [Change a Member's Role]

[Org-scoped DSO Assignment]
    └──requires──> [Create Organization]
    └──requires──> [Invite Members to Org]
```

### Dependency Notes

- **Create Organization blocks everything:** The org data model must exist before any member, invite, or switching feature can function. This is Phase 1.
- **Data isolation requires org-scoped roles:** RLS policies must reference `organization_id`, not just `dso_id`. Roles must be stored at the org-membership level.
- **Remove member is paired with invite:** An invite system without removal is incomplete. Both should ship together.
- **Org switcher requires org model:** The current DSO switcher can stay as-is until orgs exist. Once orgs exist, the switcher should switch orgs, and DSO filtering becomes secondary.
- **Transfer ownership requires role-change:** Ownership transfer is just a role change with extra validation (must leave at least one admin).

---

## MVP Definition

This is a milestone (not a greenfield project), so MVP = "minimum to make org model usable with no functionality regressions."

### Launch With (v1 — this milestone)

- [ ] `organizations` table with name, created_by, created_at
- [ ] `organization_memberships` table linking users to orgs with role
- [ ] Migrate existing `user_dso_access` data into org structure (5 DSOs → wrap in org)
- [ ] Invite members by email scoped to an org (wire up existing invite system)
- [ ] Accept invite → join org (auto-accept on login, already built)
- [ ] Cancel pending invite (already built, keep working)
- [ ] View pending invites per org (already built, keep working)
- [ ] Member list per org with roles
- [ ] Remove a member from org
- [ ] Change a member's role within an org
- [ ] Org switcher in nav (upgrade existing DSO switcher)
- [ ] Data isolation: RLS enforces org membership boundary
- [ ] Prevent org from having zero admins (block removing last admin)

### Add After Validation (v1.x)

- [ ] Leave organization (self-removal) — trigger: users ask for it
- [ ] Transfer ownership — trigger: first org where founding member needs to leave
- [ ] Resend expired invite — trigger: admin reports friction with expired invites
- [ ] Invite with pre-set DSO access — trigger: CS12 has 10+ DSOs per org

### Future Consideration (v2+)

- [ ] Org activity audit log — trigger: customer compliance requirements
- [ ] Role-based onboarding path — trigger: enough members to make onboarding confusion a reported issue
- [ ] Org-scoped DSO assignment UI — trigger: orgs with 10+ DSOs needing member-level DSO gating

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Organization data model (create/read) | HIGH | LOW | P1 |
| Org memberships + roles | HIGH | LOW | P1 |
| Data migration (existing DSOs to org) | HIGH | MEDIUM | P1 |
| Data isolation (RLS at org level) | HIGH | MEDIUM | P1 |
| Invite members | HIGH | LOW (already built) | P1 |
| Member list | HIGH | LOW (already built) | P1 |
| Remove member | HIGH | LOW | P1 |
| Change member role | HIGH | LOW | P1 |
| Org switcher UI | HIGH | LOW (already built) | P1 |
| Prevent zero-admin state | HIGH | LOW | P1 |
| Accept invite (auto on login) | HIGH | LOW (already built) | P1 |
| Cancel pending invite | MEDIUM | LOW (already built) | P2 |
| View pending invites | MEDIUM | LOW (already built) | P2 |
| Leave organization | MEDIUM | LOW | P2 |
| Transfer ownership | MEDIUM | MEDIUM | P2 |
| Resend expired invite | LOW | LOW | P3 |
| Org activity audit log | LOW | HIGH | P3 |
| Role-based onboarding path | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch — org model is unusable without these
- P2: Should have, add when core is stable
- P3: Nice to have, future milestone

---

## Competitor Feature Analysis

Reference implementations studied to validate table stakes classification:

| Feature | Linear | Slack | Notion | CS12 Target |
|---------|--------|-------|--------|-------------|
| Create org | Yes — sign-up creates org | Yes | Yes | Yes (this milestone) |
| Invite by email | Yes | Yes | Yes | Yes (exists, wire up) |
| Roles | owner/member/guest | owner/admin/member | owner/admin/member/guest | admin/manager/viewer |
| Org switcher | Top of sidebar | Workspace switcher | Sidebar switcher | Upgrade existing DSO switcher |
| Remove member | Yes | Yes | Yes | Yes (new) |
| Leave org | Yes | Yes | Yes | Yes (v1.x) |
| Transfer ownership | Yes | Yes | Yes | Yes (v1.x) |
| SAML SSO per org | Yes (enterprise) | Yes (paid) | Yes (enterprise) | No — not this milestone |
| Custom roles | No (fixed) | No (fixed) | No (fixed) | No — keep 3 fixed roles |

**Key takeaway:** Linear, Slack, and Notion all use fixed role sets (3-4 roles max) at the org level. Custom role builders are reserved for enterprise-grade systems. CS12's admin/manager/viewer model is correct.

---

## Sources

- [WorkOS: Model your B2B SaaS with organizations](https://workos.com/blog/model-your-b2b-saas-with-organizations) — MEDIUM confidence (industry practitioner, well-cited)
- [Flightcontrol: Ultimate guide to multi-tenant SaaS data modeling](https://www.flightcontrol.dev/blog/ultimate-guide-to-multi-tenant-saas-data-modeling) — MEDIUM confidence
- [Auth0: User onboarding strategies in B2B SaaS](https://auth0.com/blog/user-onboarding-strategies-b2b-saas/) — MEDIUM confidence (official Auth0 documentation-adjacent)
- [PageFlows: Designing an intuitive user flow for inviting teammates](https://pageflows.com/resources/invite-teammates-user-flow/) — LOW confidence (single practitioner source)
- [WorkOS: Top RBAC providers for multi-tenant SaaS 2025](https://workos.com/blog/top-rbac-providers-for-multi-tenant-saas-2025) — MEDIUM confidence
- [EnterpriseReady: Role Based Access Control](https://www.enterpriseready.io/features/role-based-access-control/) — MEDIUM confidence (widely referenced practitioner guide)
- CS12 codebase inspection — HIGH confidence (authoritative source for what already exists)

---

*Feature research for: CS12 multi-tenant organization workspace milestone*
*Researched: 2026-02-26*
