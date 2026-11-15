-- Drop redundant foreign key constraint fk_orders_assigned_rider on public.orders
-- so PostgREST embedded relation queries (`assigned_rider:riders (...)`) resolve
-- unambiguously via orders_assigned_rider_id_fkey instead of failing with PGRST201.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_assigned_rider;

NOTIFY pgrst, 'reload schema';
