# Konekt Platform

A comprehensive customer success tracking application for monitoring doctors/dentists through a 12-month onboarding program.

## Features

- **Executive Dashboard**: Real-time metrics and risk distribution
- **Doctor Tracking**: Comprehensive table view with search and filtering
- **Risk Level Calculation**: Automated risk detection based on engagement patterns
- **Activity Logging**: Track all interactions with doctors
- **Period Progress**: Monthly tracking of cases and courses
- **Multi-DSO Support**: Manage multiple Dental Service Organizations

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Database**: Supabase (PostgreSQL)
- **UI**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript
- **Testing**: Vitest + Playwright

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase account

### Setup

1. **Clone and install dependencies**:
   ```bash
   cd konekt-app
   npm install
   ```

2. **Set up Supabase**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Run the schema SQL from `supabase/schema.sql` in the Supabase SQL editor

3. **Configure environment variables**:
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Seed sample data** (optional):
   - Go to Supabase SQL editor
   - Insert sample DSOs and doctors for testing

5. **Run the development server**:
   ```bash
   npm run dev
   ```

6. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
konekt-app/
├── app/                      # Next.js app router
│   ├── api/                  # API routes
│   │   ├── doctors/          # Doctor CRUD endpoints
│   │   ├── activities/       # Activity logging
│   │   ├── dsos/             # DSO management
│   │   └── dashboard/        # Dashboard metrics
│   ├── doctors/              # Doctor pages
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page (dashboard)
├── components/               # React components
│   ├── dashboard/            # Dashboard components
│   ├── doctors/              # Doctor components
│   └── ui/                   # shadcn/ui components
├── lib/                      # Utilities and business logic
│   ├── calculations/         # Risk level, metrics
│   └── db/                   # Database types and client
└── supabase/                 # Database schema
```

## Key Features Implementation

### Risk Level Calculation
Risk levels are calculated based on:
- Days since last activity
- Engagement score (cases submitted vs expected)
- Course completion rate

See `lib/calculations/risk-level.ts` for details.

### Monthly Metrics Aggregation
Period progress is aggregated into calendar months with proportional distribution for overlapping periods.

See `lib/calculations/metrics.ts` for details.

### Row Level Security (RLS)
All database tables have RLS policies ensuring users only see data for their assigned DSOs.

## API Endpoints

- `GET /api/doctors` - List doctors with filters
- `POST /api/doctors` - Create new doctor
- `GET /api/doctors/[id]` - Get doctor details
- `PATCH /api/doctors/[id]` - Update doctor
- `DELETE /api/doctors/[id]` - Delete doctor
- `GET /api/doctors/[id]/periods` - Get period progress
- `PATCH /api/doctors/[id]/periods` - Update period
- `GET /api/activities` - List activities
- `POST /api/activities` - Log new activity
- `GET /api/dsos` - List DSOs
- `GET /api/dashboard/metrics` - Dashboard metrics

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npx playwright test
```

## Deployment

The application is designed to be deployed on Vercel with Supabase as the database.

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

## Next Steps

- [ ] Add authentication (Supabase Auth)
- [ ] Implement activity logging dialog
- [ ] Add period progress editing
- [ ] Create PDF export functionality
- [ ] Build task board for onboarding tasks
- [ ] Add real-time subscriptions
- [ ] Implement CSV import

## License

MIT
