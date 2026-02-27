-- ============================================================================
-- Migration: Auto-create organization on user signup
-- Phase 2: Auth Helpers and Org API (ORG-01)
-- ============================================================================
-- When a new user signs up, automatically:
--   1. Create an organization named "[Name]'s Organization"
--   2. Add the user as owner in org_members
--   3. Insert a user_profiles row (idempotent via ON CONFLICT)
--
-- Trigger: AFTER INSERT ON auth.users
-- Security: SECURITY DEFINER (runs as function owner = postgres)
-- ============================================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    new_org_slug TEXT;
    base_slug TEXT;
    counter INT := 0;
    user_name TEXT;
BEGIN
    -- Determine display name from user metadata
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Generate base slug from email prefix (lowercase, alphanumeric + hyphens only)
    base_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
    base_slug := TRIM(BOTH '-' FROM base_slug);
    -- Default if slug is empty after sanitization
    IF base_slug = '' THEN base_slug := 'org'; END IF;

    new_org_slug := base_slug;

    -- Ensure slug uniqueness by appending counter if needed
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = new_org_slug) LOOP
        counter := counter + 1;
        new_org_slug := base_slug || '-' || counter;
    END LOOP;

    -- Create the organization
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES (user_name || '''s Organization', new_org_slug, NEW.id)
    RETURNING id INTO new_org_id;

    -- Add the user as owner
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');

    -- Insert user_profiles row (idempotent — Phase 1 may have pre-seeded some users)
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

-- 2. Create the trigger (fires after each new auth.users insert)
-- Note: auth schema is accessible to postgres role (migration owner).
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();
