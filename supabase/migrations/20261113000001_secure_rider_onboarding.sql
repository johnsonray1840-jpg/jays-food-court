-- Phase 5.1: Secure Rider Onboarding, Lifecycle States & Invitations
-- Strictly preserves existing historical assignments, orders, and payment records.

-- 1. Create rider_account_status ENUM or check constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rider_status') THEN
    CREATE TYPE public.rider_status AS ENUM ('invited', 'pending_activation', 'active', 'suspended', 'deactivated');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add status, zone, and invited metadata columns to riders table safely
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS operational_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- 3. Create rider_invitations table for owner/manager controlled onboarding
CREATE TABLE IF NOT EXISTS public.rider_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  operational_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  invitation_token_hash TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rider_invitations_email ON public.rider_invitations(email);
CREATE INDEX IF NOT EXISTS idx_rider_invitations_token ON public.rider_invitations(invitation_token_hash);
