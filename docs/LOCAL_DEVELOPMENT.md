# Local Development Setup

This guide explains how to run Supabase locally for safe development.

---

## Why Local Development?

```
WITHOUT LOCAL SUPABASE:
  Developer → Production Database → Real users affected by mistakes

WITH LOCAL SUPABASE:
  Developer → Local Database → Test safely → Push when ready → Production
```

---

## One-Time Setup (15 minutes)

### 1. Install Docker Desktop

Download and install from: https://www.docker.com/products/docker-desktop/

After installing, make sure Docker is running (whale icon in menu bar).

### 2. Install Supabase CLI

```bash
# Using Homebrew (recommended for Mac)
brew install supabase/tap/supabase

# Or using npm
npm install -g supabase
```

Verify installation:
```bash
supabase --version
```

### 3. Link to Production Project

```bash
cd cs12-app
supabase login
supabase link --project-ref vekxzuupejmitvwwokrf
```

This connects your local setup to the production project for pushing changes.

---

## Daily Workflow

### Starting Local Development

```bash
# 1. Start local Supabase (takes ~30 seconds first time)
npm run supabase:start

# 2. Switch to local environment
cp .env.local.supabase .env.local

# 3. Start the app
npm run dev

# 4. Open local Supabase Studio (database admin UI)
npm run supabase:studio
```

### What You Get

| Service | URL | Description |
|---------|-----|-------------|
| App | http://localhost:3000 | Your Next.js app |
| Supabase Studio | http://localhost:54323 | Database admin UI |
| API | http://localhost:54321 | Supabase API |
| Inbucket | http://localhost:54324 | Fake email inbox for testing |

### Stopping Local Development

```bash
npm run supabase:stop
```

### Switching Back to Production

```bash
# Restore production environment
cp .env.local.production .env.local  # (save your prod env first!)

# Or manually edit .env.local to use production URLs
```

---

## Database Changes Workflow

### Making Schema Changes

1. **Make changes locally** using Supabase Studio or SQL
2. **Test thoroughly** with the local app
3. **Create a migration file**:
   ```bash
   supabase migration new my_change_name
   ```
4. **Write SQL** in the new migration file
5. **Test the migration**:
   ```bash
   npm run supabase:reset  # Resets local DB and runs all migrations
   ```
6. **Push to production** when ready:
   ```bash
   npm run supabase:push
   ```

### Pulling Production Changes

If someone else pushed changes:
```bash
npm run supabase:pull
```

---

## Seed Data

Local database starts empty. To add test data:

```bash
# Run seed file
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql

# Or use Supabase Studio to import data
```

---

## Commands Reference

| Command | What it does |
|---------|--------------|
| `npm run supabase:start` | Start local Supabase |
| `npm run supabase:stop` | Stop local Supabase |
| `npm run supabase:reset` | Wipe local DB and rerun migrations |
| `npm run supabase:studio` | Open database admin UI |
| `npm run supabase:status` | Check what's running |
| `npm run supabase:push` | Push migrations to production |
| `npm run supabase:pull` | Pull schema from production |

---

## Troubleshooting

### "Docker is not running"

Start Docker Desktop from your Applications folder.

### "Port already in use"

```bash
# Check what's using the port
lsof -i :54321

# Stop local Supabase and restart
npm run supabase:stop
npm run supabase:start
```

### "Migrations failed"

```bash
# See detailed error
supabase db reset --debug

# Check migration files in supabase/migrations/
```

### "Can't connect to local database"

Make sure you're using the local environment file:
```bash
cp .env.local.supabase .env.local
```

---

## File Structure

```
supabase/
├── config.toml          # Local Supabase configuration
├── migrations/          # Database migrations (version controlled)
│   ├── 20241206000000_initial_schema.sql
│   ├── 20250115_add_team_invites.sql
│   └── ...
└── seed.sql             # Test data for local development
```

---

## Best Practices

1. **Never edit production directly** - Always use migrations
2. **Test migrations locally first** - Run `supabase:reset` before pushing
3. **One change per migration** - Easier to debug and rollback
4. **Descriptive migration names** - `add_user_preferences` not `update`
5. **Commit migrations** - They should be in version control

---

## Environment Files

| File | Purpose |
|------|---------|
| `.env.local` | Currently active environment |
| `.env.local.supabase` | Local development settings (safe to commit) |
| `.env.local.example` | Template showing required variables |

**Important**: Never commit `.env.local` with production keys!
