create table if not exists public.payout_execution_grants (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  action text not null check (
    action in ('confirmRelease', 'adminResolveRelease', 'adminResolveRefund')
  ),
  resolution text null check (resolution in ('release', 'refund')),
  issued_to_wallet text not null,
  issued_by_wallet text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_payout_execution_grants_active_lookup
  on public.payout_execution_grants (deal_id, issued_to_wallet, expires_at)
  where used_at is null;

comment on table public.payout_execution_grants is 'Short-lived one-time grants exchanged for final payout calldata.';
comment on column public.payout_execution_grants.action is 'Escrow payout function that may be prepared on exchange.';
comment on column public.payout_execution_grants.resolution is 'Admin resolution semantic value; null for buyer confirmRelease path.';
comment on column public.payout_execution_grants.token_hash is 'SHA-256 of the raw 32-byte grant token.';

alter table public.payout_execution_grants enable row level security;
