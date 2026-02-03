# Database Migration Guide: Supabase to Direct Postgres

> **Current Status**: Using Supabase (PostgreSQL + Auth + RLS)
> **Decision Date**: February 2026
> **Decision**: Stay with Supabase until migration indicators are triggered

---

## Migration Indicators Checklist

Review this checklist periodically. If **3+ indicators** are checked, it's time to seriously evaluate migration.

### Cost Indicators

- [ ] **Monthly Supabase bill exceeds $100/month** for database alone
- [ ] **Approaching plan limits** (database size, bandwidth, API requests)
- [ ] **Paying for features you don't use** (Realtime, Storage, Edge Functions)
- [ ] **Cost per query** becomes a concern at scale

### Performance Indicators

- [ ] **API response times exceed 200ms** consistently due to Supabase overhead
- [ ] **Cold start latency** from Supabase connection pooling affects UX
- [ ] **Query complexity hits Supabase SDK limits** (need raw SQL, CTEs, window functions)
- [ ] **Batch operations are slow** due to SDK overhead vs. direct SQL

### Development Experience Indicators

- [ ] **Supabase SDK feels limiting** - fighting the abstraction more than it helps
- [ ] **Type generation issues** - Supabase types don't match your needs
- [ ] **Local development friction** - want to work offline or with faster local DB
- [ ] **Testing is painful** - mocking Supabase client is cumbersome
- [ ] **Migrations workflow** doesn't fit your team's process

### Feature/Control Indicators

- [ ] **Need Postgres extensions** Supabase doesn't support (PostGIS advanced features, pgvector, etc.)
- [ ] **Need database triggers** beyond what Supabase exposes
- [ ] **Want connection pooling control** (PgBouncer configuration)
- [ ] **Need read replicas** for scaling
- [ ] **Compliance requirements** mandate self-hosted or specific cloud provider

### Auth-Specific Indicators

- [ ] **Supabase Auth limitations** blocking features (custom claims, specific OAuth providers)
- [ ] **Need to integrate with existing identity provider** (Okta, Auth0, corporate SSO)
- [ ] **Auth pricing** becoming significant at user scale
- [ ] **Want auth provider flexibility** (switch between providers without data migration)

### Vendor Lock-in Concerns

- [ ] **Strategic need for vendor independence**
- [ ] **Supabase company/product direction concerns**
- [ ] **Need multi-cloud deployment capability**
- [ ] **Acquisition or regulatory changes** affecting Supabase

---

## Current Supabase Usage Summary

**What we actively use:**
- PostgreSQL database (15+ tables)
- Row Level Security (RLS) policies
- Supabase Auth (email/password, Google OAuth, magic links)
- Supabase SDK for queries

**What we DON'T use:**
- Realtime subscriptions
- Storage buckets
- Edge Functions
- Supabase Vector/AI features

**Migration scope:**
- 31 API routes need query refactoring
- Auth system requires full replacement
- RLS policies need app-layer implementation OR keep Postgres RLS

---

## Recommended Migration Path

If indicators suggest migration, follow this order:

### Phase 1: Local Development Setup (Low Risk)
1. Set up Docker Compose with local Postgres
2. Add Drizzle ORM alongside Supabase (don't replace yet)
3. Generate Drizzle schema from existing database
4. Run both in parallel for comparison

### Phase 2: Query Migration (Medium Risk)
1. Create a feature flag for "use Drizzle" vs "use Supabase"
2. Migrate API routes one-by-one, starting with least critical
3. Compare results between old and new implementations
4. Run shadow testing in production (both run, compare results)

### Phase 3: Auth Migration (High Risk - Do Last)
1. Evaluate options: NextAuth, Clerk, Lucia, custom JWT
2. Plan user migration strategy (session continuity)
3. Implement parallel auth system
4. Migrate users gradually with fallback

### Phase 4: Cutover
1. Remove Supabase SDK dependencies
2. Update environment configuration
3. Decommission Supabase project (keep backup)

---

## Technology Recommendations

### ORM Choice: Drizzle (Recommended)

**Why Drizzle over Prisma:**
- SQL-first approach matches our existing query patterns
- Lighter bundle size (~35KB vs ~2MB)
- Works well with Edge/Serverless (Next.js)
- Better performance (thin SQL wrapper)
- Native raw SQL support

**Example migration:**
```typescript
// Before (Supabase)
const { data } = await supabase
  .from('doctors')
  .select('*, activities(*)')
  .eq('dso_id', dsoId);

// After (Drizzle)
const data = await db.query.doctors.findMany({
  where: eq(doctors.dsoId, dsoId),
  with: { activities: true }
});
```

### Auth Replacement Options

| Option | Pros | Cons |
|--------|------|------|
| **NextAuth** | Built for Next.js, free | Less features than dedicated auth |
| **Clerk** | Excellent UX, managed | Cost at scale, vendor lock-in |
| **Lucia** | Lightweight, flexible | More DIY required |
| **Custom JWT** | Full control | Security risk if done wrong |

### Database Hosting Options

| Option | Pros | Cons |
|--------|------|------|
| **Neon** | Serverless, branching, free tier | Newer, fewer regions |
| **Supabase (DB only)** | Keep familiar, just drop Auth | Still some lock-in |
| **Railway** | Simple, good DX | Smaller company |
| **PlanetScale** | MySQL only | Not Postgres |
| **AWS RDS** | Enterprise, full control | Complex, expensive |
| **Self-hosted** | Maximum control | Ops burden |

---

## What to Preserve

### Keep from Current Setup
- Database schema (Postgres is Postgres)
- RLS policies (can keep in Postgres, or move to app layer)
- Migration files (convert to Drizzle migrations)
- Type definitions (generate from Drizzle schema)

### Must Rebuild
- Authentication flow
- Session management
- Query layer (all 31 API routes)
- Auth middleware

---

## Estimated Migration Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Local Docker setup | 2-4 hours | Low |
| Drizzle schema setup | 4-8 hours | Low |
| Query migration (31 routes) | 2-3 days | Medium |
| Auth replacement | 3-5 days | High |
| Testing & validation | 2-3 days | Medium |
| **Total** | **2-3 weeks** | **Medium-High** |

---

## Decision Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| Feb 2026 | Stay with Supabase | Working well, no indicators triggered, migration effort high |

---

## Periodic Review Schedule

Review this document and checklist:
- **Quarterly**: Quick scan of indicators
- **When hitting limits**: Immediate review
- **Before major features**: Consider if migration would help
- **Annual**: Full evaluation of alternatives

---

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle + Next.js Guide](https://orm.drizzle.team/docs/get-started-postgresql)
- [NextAuth.js](https://next-auth.js.org/)
- [Neon Database](https://neon.tech/)
- [Supabase to Drizzle Migration Guide](https://orm.drizzle.team/docs/guides/supabase)
