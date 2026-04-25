-- Migration 026: Team member invites
-- Adds invitations table, extends role enum, stores email in profiles,
-- updates handle_new_user trigger to handle invited users.

-- 1. Add email column to profiles (for team member display without auth.users join)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;

-- 2. Extend role check to include member and viewer
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'member', 'viewer'));

-- 3. Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'member'
                          CHECK (role IN ('admin', 'member', 'viewer')),
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz
);

CREATE INDEX IF NOT EXISTS invitations_tenant_id_idx ON public.invitations (tenant_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx     ON public.invitations (token);

-- 4. RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Authenticated tenant members can manage their own tenant's invitations
CREATE POLICY "invitations: tenant admin crud" ON public.invitations
  FOR ALL TO authenticated
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

-- Anon (or any user) can read a single invite by token to validate it on the accept page
CREATE POLICY "invitations: public read by token" ON public.invitations
  FOR SELECT TO anon
  USING (true);

-- 5. Update profiles RLS: allow reading ALL profiles in the same tenant
--    (previously only own row was readable)
DROP POLICY IF EXISTS "Profiles are viewable by the profile owner." ON public.profiles;
DROP POLICY IF EXISTS "profiles: own row"                           ON public.profiles;

CREATE POLICY "profiles: read own tenant" ON public.profiles
  FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "profiles: update own row" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 6. Update handle_new_user trigger to skip tenant creation for invited users.
--    Invited users pass invite_token in auth user_metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_tenant_name text;
  v_tenant_slug text;
  v_tenant_id   uuid;
  v_invite_token text;
  v_invite      record;
BEGIN
  v_invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF v_invite_token IS NOT NULL THEN
    -- Invited user: find pending, non-expired invite and join that tenant
    SELECT * INTO v_invite
    FROM public.invitations
    WHERE token = v_invite_token
      AND accepted_at IS NULL
      AND expires_at > now()
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.profiles (id, tenant_id, role, email)
      VALUES (NEW.id, v_invite.tenant_id, v_invite.role, NEW.email);

      UPDATE public.invitations
      SET accepted_at = now()
      WHERE id = v_invite.id;

      RETURN NEW;
    END IF;
    -- If token invalid/expired, fall through to normal signup
  END IF;

  -- Normal signup: create a new tenant + admin profile
  v_tenant_name := COALESCE(NEW.raw_user_meta_data->>'tenant_name', split_part(NEW.email, '@', 1));
  v_tenant_slug := COALESCE(NEW.raw_user_meta_data->>'tenant_slug',
                    regexp_replace(lower(v_tenant_name), '[^a-z0-9]+', '-', 'g'));

  INSERT INTO public.tenants (name, slug)
  VALUES (v_tenant_name, v_tenant_slug)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, role, email)
  VALUES (NEW.id, v_tenant_id, 'admin', NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
