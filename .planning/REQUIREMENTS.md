# Requirements: CS12 Multi-Tenant Workspaces

**Defined:** 2026-02-26
**Core Value:** Users can manage DSO portfolios within an organization, invite team members, and assign DSO access — without seeing other organizations' data.

**Model:** Option 1 — Single org, assign DSOs to members. One organization owns DSOs, admin invites members and assigns them to specific DSOs. Follows MakerKit pattern (organizations table + org_members join table).

## v1 Requirements

### Organization Management

- [ ] **ORG-01**: Organization auto-created for first user on signup (becomes owner)
- [ ] **ORG-02**: Organization has name and unique slug
- [ ] **ORG-03**: Organization owner can rename the organization
- [ ] **ORG-04**: Existing data migrated — all current DSOs placed under a default organization for Alan

### Member Management

- [ ] **MBR-01**: Org owner/admin can invite users by email to the organization
- [ ] **MBR-02**: Invited user can accept invite and join the organization
- [ ] **MBR-03**: Org owner/admin can assign a member to specific DSOs within the org
- [ ] **MBR-04**: Org owner/admin can remove a member's access to specific DSOs
- [ ] **MBR-05**: Org owner/admin can remove a member from the organization entirely
- [ ] **MBR-06**: Org owner/admin can change a member's org-level role
- [ ] **MBR-07**: Organization roles: owner, admin, member (fixed set — no custom roles)
- [ ] **MBR-08**: Zero-admin guard — cannot remove the last owner

### UI

- [ ] **UI-01**: Organization settings page shows org name, members list with roles, DSO assignments
- [ ] **UI-02**: Member can see which DSOs they're assigned to
- [ ] **UI-03**: Admin can manage DSO assignments from settings (add/remove member from DSO)

### Data Isolation

- [ ] **ISO-01**: DSOs belong to exactly one organization (via org_id column)
- [ ] **ISO-02**: Members only see DSOs within their org that they're assigned to
- [ ] **ISO-03**: All API routes enforce org membership before granting access
- [ ] **ISO-04**: Fix existing invite bug — invites scoped to org, not all inviter's DSOs

### Database & Infrastructure

- [ ] **DB-01**: `organizations` table: id, name, slug, created_by, created_at
- [ ] **DB-02**: `org_members` table: org_id, user_id, role, joined_at
- [ ] **DB-03**: `dsos` table gets `org_id` foreign key
- [ ] **DB-04**: `user_profiles` table: id, email, name (avoid N+1 auth API calls)
- [ ] **DB-05**: Zero-downtime migration — `user_dso_access` kept during transition period
- [ ] **DB-06**: Auth helper `requireOrgAccess()` added to `lib/auth.ts`

## v2 Requirements

### Multi-Org Support

- **MORG-01**: User can belong to multiple organizations
- **MORG-02**: Organization switcher in sidebar to switch between orgs
- **MORG-03**: Personal workspace (Option 2) for individual users

### Advanced Member Management

- **ADV-01**: Member can leave an organization
- **ADV-02**: Transfer organization ownership to another member
- **ADV-03**: Audit log of member additions/removals

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom roles | Industry evidence (Linear, Slack, Notion) confirms fixed role sets are correct for this scale |
| Cross-org DSO sharing | A DSO belongs to one org only — simplifies data model significantly |
| Billing per organization | No monetization yet |
| Organization branding/theming | Unnecessary complexity for current needs |
| RLS-first approach | Current app uses service role key in all 31 routes — introducing RLS is a separate future milestone |
| Org slug in URL paths | Adds routing complexity — store active org in context/localStorage instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORG-01 | — | Pending |
| ORG-02 | — | Pending |
| ORG-03 | — | Pending |
| ORG-04 | — | Pending |
| MBR-01 | — | Pending |
| MBR-02 | — | Pending |
| MBR-03 | — | Pending |
| MBR-04 | — | Pending |
| MBR-05 | — | Pending |
| MBR-06 | — | Pending |
| MBR-07 | — | Pending |
| MBR-08 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| ISO-01 | — | Pending |
| ISO-02 | — | Pending |
| ISO-03 | — | Pending |
| ISO-04 | — | Pending |
| DB-01 | — | Pending |
| DB-02 | — | Pending |
| DB-03 | — | Pending |
| DB-04 | — | Pending |
| DB-05 | — | Pending |
| DB-06 | — | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
