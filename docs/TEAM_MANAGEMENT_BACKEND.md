# Team Management Backend Implementation

This document outlines how to implement the full Supabase backend for the team management feature.

## Current State

- **UI**: Complete (`/settings` page with team management)
- **API**: Mock data mode (returns hardcoded data)
- **Database**: Schema exists in `src/supabase/schema.sql`

---

## Implementation Steps

### 1. Add User Profiles Table

Run this SQL in your Supabase dashboard (SQL Editor):

```sql
-- Store user display info (Supabase Auth only stores email)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles (needed for team member display)
CREATE POLICY "Users can view all profiles"
    ON user_profiles FOR SELECT
    USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 2. Add Workspace Invites Table (Optional)

For custom email invites with more control:

```sql
CREATE TABLE IF NOT EXISTS workspace_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    dso_id UUID NOT NULL REFERENCES dsos(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(email, dso_id)
);

-- Enable RLS
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Admins can manage invites for their workspaces
CREATE POLICY "Admins can manage invites"
    ON workspace_invites FOR ALL
    USING (
        dso_id IN (
            SELECT dso_id FROM user_dso_access
            WHERE user_id = auth.uid()::text AND role = 'admin'
        )
    );

-- Anyone can view invite by token (for accepting)
CREATE POLICY "Anyone can view invite by token"
    ON workspace_invites FOR SELECT
    USING (true);
```

---

### 3. Update API Routes

#### `/app/api/team/route.ts`

Replace mock implementation with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createClient() {
    const cookieStore = cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current workspace from query or session
        const { searchParams } = new URL(request.url);
        const dsoId = searchParams.get('dso_id');

        if (!dsoId) {
            return NextResponse.json({ error: 'dso_id required' }, { status: 400 });
        }

        // Verify user has access to this workspace
        const { data: access } = await supabase
            .from('user_dso_access')
            .select('role')
            .eq('user_id', user.id)
            .eq('dso_id', dsoId)
            .single();

        if (!access) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Get all team members for this workspace
        const { data: members, error } = await supabase
            .from('user_dso_access')
            .select(`
                id,
                user_id,
                role,
                created_at,
                user_profiles!inner (
                    email,
                    name,
                    avatar_url
                )
            `)
            .eq('dso_id', dsoId);

        if (error) {
            console.error('Error fetching team members:', error);
            return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
        }

        // Transform data and mark current user
        const transformedMembers = members?.map(m => ({
            id: m.id,
            user_id: m.user_id,
            email: m.user_profiles.email,
            name: m.user_profiles.name || m.user_profiles.email.split('@')[0],
            role: m.role,
            created_at: m.created_at,
            is_current_user: m.user_id === user.id,
        }));

        return NextResponse.json({ members: transformedMembers });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { email, name, role, dso_id } = body;

        // Verify current user is admin of this workspace
        const { data: access } = await supabase
            .from('user_dso_access')
            .select('role')
            .eq('user_id', user.id)
            .eq('dso_id', dso_id)
            .single();

        if (access?.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can add members' }, { status: 403 });
        }

        // Check if user exists in Supabase Auth
        // Note: This requires service role key for admin.listUsers
        // Alternative: Look up by email in user_profiles
        const { data: existingProfile } = await supabase
            .from('user_profiles')
            .select('id, email, name')
            .eq('email', email.toLowerCase())
            .single();

        if (!existingProfile) {
            return NextResponse.json(
                { error: 'User not found. Send an invite instead.' },
                { status: 404 }
            );
        }

        // Check if already a member
        const { data: existingAccess } = await supabase
            .from('user_dso_access')
            .select('id')
            .eq('user_id', existingProfile.id)
            .eq('dso_id', dso_id)
            .single();

        if (existingAccess) {
            return NextResponse.json(
                { error: 'User is already a member of this workspace' },
                { status: 409 }
            );
        }

        // Add user to workspace
        const { data: newAccess, error: insertError } = await supabase
            .from('user_dso_access')
            .insert({
                user_id: existingProfile.id,
                dso_id,
                role,
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error adding member:', insertError);
            return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
        }

        return NextResponse.json({
            id: newAccess.id,
            user_id: existingProfile.id,
            email: existingProfile.email,
            name: existingProfile.name || name,
            role,
            created_at: newAccess.created_at,
        }, { status: 201 });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

#### `/app/api/team/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createClient() {
    const cookieStore = cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { role } = body;

        // Get the access record to find dso_id
        const { data: targetAccess } = await supabase
            .from('user_dso_access')
            .select('dso_id, role, user_id')
            .eq('id', id)
            .single();

        if (!targetAccess) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        // Verify current user is admin
        const { data: currentAccess } = await supabase
            .from('user_dso_access')
            .select('role')
            .eq('user_id', user.id)
            .eq('dso_id', targetAccess.dso_id)
            .single();

        if (currentAccess?.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can change roles' }, { status: 403 });
        }

        // Prevent demoting last admin
        if (targetAccess.role === 'admin' && role !== 'admin') {
            const { count } = await supabase
                .from('user_dso_access')
                .select('*', { count: 'exact', head: true })
                .eq('dso_id', targetAccess.dso_id)
                .eq('role', 'admin');

            if (count && count <= 1) {
                return NextResponse.json(
                    { error: 'Cannot change role. At least one admin required.' },
                    { status: 400 }
                );
            }
        }

        // Update role
        const { data, error } = await supabase
            .from('user_dso_access')
            .update({ role })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the access record
        const { data: targetAccess } = await supabase
            .from('user_dso_access')
            .select('dso_id, role, user_id')
            .eq('id', id)
            .single();

        if (!targetAccess) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        // Prevent self-removal
        if (targetAccess.user_id === user.id) {
            return NextResponse.json(
                { error: 'You cannot remove yourself' },
                { status: 400 }
            );
        }

        // Verify current user is admin
        const { data: currentAccess } = await supabase
            .from('user_dso_access')
            .select('role')
            .eq('user_id', user.id)
            .eq('dso_id', targetAccess.dso_id)
            .single();

        if (currentAccess?.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 });
        }

        // Prevent removing last admin
        if (targetAccess.role === 'admin') {
            const { count } = await supabase
                .from('user_dso_access')
                .select('*', { count: 'exact', head: true })
                .eq('dso_id', targetAccess.dso_id)
                .eq('role', 'admin');

            if (count && count <= 1) {
                return NextResponse.json(
                    { error: 'Cannot remove the last admin' },
                    { status: 400 }
                );
            }
        }

        // Remove member
        const { error } = await supabase
            .from('user_dso_access')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

#### `/app/api/team/invite/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Option 1: Using Supabase's built-in invite (requires service role)
// Option 2: Custom invite table (shown below)

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { email, role, dso_id } = body;

        // Verify current user is admin
        const { data: access } = await supabase
            .from('user_dso_access')
            .select('role')
            .eq('user_id', user.id)
            .eq('dso_id', dso_id)
            .single();

        if (access?.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can invite' }, { status: 403 });
        }

        // Check if already invited
        const { data: existingInvite } = await supabase
            .from('workspace_invites')
            .select('id')
            .eq('email', email.toLowerCase())
            .eq('dso_id', dso_id)
            .is('accepted_at', null)
            .single();

        if (existingInvite) {
            return NextResponse.json(
                { error: 'Invite already sent to this email' },
                { status: 409 }
            );
        }

        // Create invite
        const { data: invite, error } = await supabase
            .from('workspace_invites')
            .insert({
                email: email.toLowerCase(),
                dso_id,
                role,
                invited_by: user.id,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating invite:', error);
            return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
        }

        // TODO: Send email with invite link
        // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`;
        // await sendEmail({ to: email, subject: 'Workspace Invite', inviteUrl });

        return NextResponse.json({
            success: true,
            message: `Invitation sent to ${email}`,
            invite: {
                id: invite.id,
                email: invite.email,
                role: invite.role,
                expires_at: invite.expires_at,
            }
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

---

### 4. Add Invite Accept Page

Create `/app/invite/[token]/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/db/client';

export default function AcceptInvitePage() {
    const params = useParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState('');

    useEffect(() => {
        acceptInvite();
    }, []);

    async function acceptInvite() {
        const supabase = createClient();

        // Check if logged in
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Redirect to login with return URL
            router.push(`/login?redirect=/invite/${params.token}`);
            return;
        }

        // Accept invite via API
        const res = await fetch(`/api/team/invite/${params.token}/accept`, {
            method: 'POST',
        });

        if (res.ok) {
            setStatus('success');
            setTimeout(() => router.push('/'), 2000);
        } else {
            const data = await res.json();
            setError(data.error || 'Failed to accept invite');
            setStatus('error');
        }
    }

    // Render UI based on status...
}
```

---

### 5. Environment Variables

Ensure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# For admin operations (invite emails, etc.)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

### 6. Email Provider (for invites)

Options:
- **Supabase Email**: Built-in, limited to 4/hour on free tier
- **Resend**: Easy setup, generous free tier
- **SendGrid**: Enterprise option

Example with Resend:

```bash
npm install resend
```

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
    from: 'Konekt <noreply@yourdomain.com>',
    to: email,
    subject: 'You\'ve been invited to join a workspace',
    html: `<a href="${inviteUrl}">Accept Invite</a>`,
});
```

---

## Testing Checklist

- [ ] Create Supabase project and add env vars
- [ ] Run SQL migrations (user_profiles, workspace_invites)
- [ ] Test user signup creates profile
- [ ] Test adding existing user to workspace
- [ ] Test role changes (admin can change, others cannot)
- [ ] Test removing members (prevent last admin removal)
- [ ] Test invite flow (create invite, accept invite)
- [ ] Test RLS policies block unauthorized access

---

## Security Notes

1. **Never expose service role key** to the client
2. **All mutations check admin role** before proceeding
3. **RLS policies are defense-in-depth** - API checks + DB policies
4. **Invite tokens are cryptographically random** and expire
5. **Users can only see workspaces they belong to**
