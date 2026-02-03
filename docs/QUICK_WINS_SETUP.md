# System Monitoring - CEO Guide

Simple overview of what's set up and what you need to do.

---

## Your One Bookmark

**System Health Dashboard**: `/admin/system`

This page shows:
- Overall health status (Green/Yellow/Red)
- How fast the app is responding
- Which parts are slow (if any)
- Auto-refreshes every 30 seconds

**Check it**: Weekly, or when something feels slow.

---

## One-Time Setup (10 minutes)

### Set Up Billing Alerts

This emails you when costs increase. Do this once, then forget about it.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/vekxzuupejmitvwwokrf)
2. Click **Settings** (gear icon)
3. Click **Billing**
4. Set up alerts at:
   - **$25** - Just a heads up
   - **$50** - Worth checking what's driving usage
   - **$75** - Review if this is expected growth
   - **$100** - Time to review `DATABASE_MIGRATION_GUIDE.md`

---

## What's Automatic (You Don't Need to Do Anything)

| Thing | How it works |
|-------|--------------|
| **Database backups** | Supabase does daily backups automatically |
| **Performance tracking** | App logs slow API calls automatically |
| **Health dashboard** | Updates itself every 30 seconds |

---

## When to Escalate to a Developer

Share the `/admin/system` page with a developer when:

1. **Status is Red** for more than a day
2. **Average response time** stays above 300ms
3. **Billing alert** hits $75+
4. **Users complain** about slowness

---

## Reference Documents

| Document | When to read it |
|----------|----------------|
| `DATABASE_MIGRATION_GUIDE.md` | When billing hits $100+ or performance is consistently bad |

---

## Developer Notes

*(Skip this section - it's for future developers)*

- `docker-compose.yml` - Local Postgres for development
- `npm run db:start/stop/reset` - Docker commands
- `src/lib/api-monitor.ts` - Performance tracking utility
- `src/app/api/metrics/performance/route.ts` - Raw metrics API
