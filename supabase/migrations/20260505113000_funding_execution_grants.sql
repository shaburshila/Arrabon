create table if not exists public.funding_execution_grants (
  id uuid primary key default gen_random_uuid(),
  consultation_link_id uuid not null references public.consultation_links(id) on delete cascade,
  issued_to_wallet text not null,
  issued_by_wallet text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_funding_execution_grants_active_lookup
  on public.funding_execution_grants (consultation_link_id, issued_to_wallet, expires_at)
  where used_at is null;

comment on table public.funding_execution_grants is
  'Short-lived one-time grants exchanged for final funding calldata after allowance and fresh backend validation.';

comment on column public.funding_execution_grants.token_hash is
  'SHA-256 hash of the raw 32-byte funding execution grant token.';

alter table public.funding_execution_grants enable row level security;
