CREATE TABLE IF NOT EXISTS public.customer_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_auth_email ON public.customer_auth_tokens(email);
CREATE INDEX IF NOT EXISTS idx_customer_auth_token_hash ON public.customer_auth_tokens(token_hash);
