# Claude Development Instructions

## Context
- **User**: CEO/CPO, non-technical
- **Claude's Role**: Acting as the developer for this project
- Explain technical decisions in plain language
- Always test locally before pushing to production
- Ask before making significant changes

## Project Overview
CS12 Platform - Customer success tracking for doctor/dentist onboarding programs.

## Tech Stack
- Next.js 16 (App Router)
- Supabase (PostgreSQL + Auth)
- Tailwind CSS + shadcn/ui
- TypeScript

## Development Workflow (IMPORTANT)

### Before Making Any Database Changes

1. **Start local Supabase** (if not running):
   ```bash
   supabase status  # Check if running
   supabase start   # Start if needed
   ```

2. **Test locally first**:
   - Make schema changes in a new migration file
   - Run `supabase db reset` to test migrations
   - Verify the app works with `npm run dev`

3. **Only push to production after local testing passes**:
   ```bash
   supabase db push
   ```

### For Code Changes (No Database)

1. Test with `npm run dev`
2. Run `npm run build` to verify no build errors
3. Commit when working

## Pre-Push Checklist

Before pushing ANY changes to production database:
- [ ] Tested migration locally with `supabase db reset`
- [ ] App runs without errors on `npm run dev`
- [ ] Build passes with `npm run build`
- [ ] Informed user of what will change

## File Structure

```
src/
├── app/api/          # API routes (31 endpoints)
├── app/              # Pages
├── components/       # React components
├── lib/
│   ├── auth.ts       # Authentication helpers
│   ├── db/           # Database client and types
│   └── calculations/ # Business logic
supabase/
├── config.toml       # Local Supabase config
├── migrations/       # Database migrations (run in order)
└── seed.sql          # Test data for local dev
docs/
├── LOCAL_DEVELOPMENT.md    # Local setup guide
├── DATABASE_MIGRATION_GUIDE.md  # When to migrate from Supabase
└── QUICK_WINS_SETUP.md     # Infrastructure monitoring
```

## Database

- **Production**: Supabase cloud (vekxzuupejmitvwwokrf)
- **Local**: `supabase start` (port 54321)
- **Local Studio**: http://127.0.0.1:54323

## Key Commands

```bash
# Local development
npm run dev              # Start app
supabase start           # Start local database
supabase stop            # Stop local database
supabase db reset        # Reset and rerun migrations

# Testing
npm run build            # Verify build works
npm run test             # Run unit tests

# Production database
supabase db push         # Push migrations to production (CAREFUL)
```

## Common Patterns

### Adding a new database table/column
1. Create migration: `supabase migration new descriptive_name`
2. Write SQL in the new file
3. Test: `supabase db reset`
4. Verify app works: `npm run dev`
5. Push to production: `supabase db push`

### API Routes
- All routes use `supabaseAdmin` for database access
- Auth checked via `requireAuth` or `requireDsoAccess` helpers
- Located in `src/app/api/`

## Monitoring & Health

- **System Health Dashboard**: `/admin/system` - Visual dashboard showing API performance
- **Performance Metrics API**: `/api/metrics/performance` - Raw performance data
- **API Monitoring**: Use `withMonitoring()` wrapper in `src/lib/api-monitor.ts` for new endpoints

## Important Decisions

### Supabase Migration
Currently using Supabase. See `docs/DATABASE_MIGRATION_GUIDE.md` for:
- When to consider migrating to direct Postgres
- Migration indicators checklist
- Recommended approach (Drizzle ORM)

**Don't migrate unless**: 3+ indicators are triggered (cost, performance, limitations)

## Notes

- Demo login for local testing: demo@cs12.com / demo123456
- Activity types are: 'phone', 'email', 'text'
- All tables have Row Level Security (RLS) enabled
- Google OAuth warnings on local Supabase are normal (not configured for local)
