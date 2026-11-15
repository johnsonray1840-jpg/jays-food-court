-- ==============================================================================
-- JAY'S FOOD COURT - PHASE 6: FLEET MANAGEMENT & SHARED DISPATCH HARDENING
-- ==============================================================================
-- Adds dispatch indexes, active-assignment constraints, and security definitions
-- Preserves existing order history, payments, and customer accounts.

BEGIN;

-- 1. Ensure foreign key from orders to riders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_orders_assigned_rider' AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders 
      ADD CONSTRAINT fk_orders_assigned_rider 
      FOREIGN KEY (assigned_rider_id) REFERENCES public.riders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Dispatch Pool Query Indexes
-- Essential for fast, collision-free filtering of available pool orders
CREATE INDEX IF NOT EXISTS idx_orders_dispatch_pool 
  ON public.orders (status, payment_status, assigned_rider_id, created_at)
  WHERE status = 'ready_for_pickup' AND payment_status = 'paid' AND assigned_rider_id IS NULL;

-- Index to quickly look up active delivery per courier
CREATE INDEX IF NOT EXISTS idx_orders_rider_active_delivery
  ON public.orders (assigned_rider_id, status)
  WHERE assigned_rider_id IS NOT NULL;

-- 3. Partial Unique Index: Prevent a courier from holding more than 1 active delivery simultaneously at DB level
-- Active statuses: 'assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_delivery_per_rider 
  ON public.orders (assigned_rider_id)
  WHERE status IN ('assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched') 
    AND assigned_rider_id IS NOT NULL;

-- 4. Audit Log Table for Administrative Fleet Interventions
CREATE TABLE IF NOT EXISTS public.fleet_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT NOT NULL,
  target_id TEXT,
  target_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fleet_audit_logs_actor ON public.fleet_admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_fleet_audit_logs_created_at ON public.fleet_admin_audit_logs(created_at DESC);

-- Enable RLS on audit logs
ALTER TABLE public.fleet_admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_fleet_audit_read_owner ON public.fleet_admin_audit_logs;
CREATE POLICY p_fleet_audit_read_owner ON public.fleet_admin_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE staff_profiles.id = auth.uid()
        AND staff_profiles.role IN ('owner', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS p_fleet_audit_insert_service ON public.fleet_admin_audit_logs;
CREATE POLICY p_fleet_audit_insert_service ON public.fleet_admin_audit_logs
  FOR INSERT TO authenticated, service_role
  WITH CHECK (true);

COMMIT;
