-- ==============================================================================
-- Fix security_invoker on public.order_calls compatibility view
-- ==============================================================================

ALTER VIEW public.order_calls SET (security_invoker = true);
