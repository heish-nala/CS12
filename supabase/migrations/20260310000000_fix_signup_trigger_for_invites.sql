-- ============================================================================
-- Migration: Route invited signups into inviter org instead of creating a new org
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    new_org_slug TEXT;
    base_slug TEXT;
    counter INT := 0;
    user_name TEXT;
    invite_record RECORD;
    inviter_org_id UUID;
BEGIN
    -- Determine display name from user metadata
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Check whether this signup is coming from a pending team invite
    SELECT ti.*, om.org_id
    INTO invite_record
    FROM public.team_invites ti
    JOIN public.dsos d ON d.id = ti.dso_id
    LEFT JOIN public.org_members om ON om.user_id = ti.invited_by::uuid
    WHERE ti.email = LOWER(NEW.email)
      AND ti.status = 'pending'
      AND ti.expires_at > NOW()
    ORDER BY ti.created_at DESC
    LIMIT 1;

    IF invite_record IS NOT NULL AND invite_record.org_id IS NOT NULL THEN
        inviter_org_id := invite_record.org_id;

        -- Add invited user to the inviter's org instead of creating a personal org
        INSERT INTO public.org_members (org_id, user_id, role)
        VALUES (inviter_org_id, NEW.id, 'member')
        ON CONFLICT (org_id, user_id) DO NOTHING;

        -- Mark matching pending invites for this org as accepted
        UPDATE public.team_invites ti
        SET status = 'accepted',
            accepted_at = NOW()
        FROM public.dsos d
        WHERE d.id = ti.dso_id
          AND ti.email = LOWER(NEW.email)
          AND ti.status = 'pending'
          AND ti.expires_at > NOW()
          AND d.org_id = inviter_org_id;
    ELSE
        -- Organic signup: create a fresh personal org
        base_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
        base_slug := TRIM(BOTH '-' FROM base_slug);

        IF base_slug = '' THEN
            base_slug := 'org';
        END IF;

        new_org_slug := base_slug;

        WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = new_org_slug) LOOP
            counter := counter + 1;
            new_org_slug := base_slug || '-' || counter;
        END LOOP;

        INSERT INTO public.organizations (name, slug, created_by)
        VALUES (user_name || '''s Organization', new_org_slug, NEW.id)
        RETURNING id INTO new_org_id;

        INSERT INTO public.org_members (org_id, user_id, role)
        VALUES (new_org_id, NEW.id, 'owner');
    END IF;

    -- Always create user_profiles row
    INSERT INTO public.user_profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        NULLIF(user_name, SPLIT_PART(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Repair Valentina's org membership after invite-based signup created a personal org
DELETE FROM public.org_members
WHERE user_id = 'c6615dc6-7cb5-4842-80c9-8badc7095d9f'
  AND org_id = 'dacc0b04-c088-4613-b66f-81666ccb4e00';

INSERT INTO public.org_members (org_id, user_id, role)
VALUES ('cd3a5aa0-bafe-4175-b7e7-9ff3b57c2735', 'c6615dc6-7cb5-4842-80c9-8badc7095d9f', 'member')
ON CONFLICT (org_id, user_id) DO NOTHING;

DELETE FROM public.organizations
WHERE id = 'dacc0b04-c088-4613-b66f-81666ccb4e00'
  AND NOT EXISTS (
      SELECT 1
      FROM public.org_members
      WHERE org_id = 'dacc0b04-c088-4613-b66f-81666ccb4e00'
  );
