create table if not exists public.deal_payout_block_requests (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  onchain_deal_id text not null,
  blocked boolean not null,
  source text not null check (source in ('denylist_add')),
  status text not null default 'pending' check (status in ('pending', 'applied', 'non_actionable')),
  applied_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.deal_payout_block_requests is
  'Deferred onchain payout-block requests for active deals. Used for retryable compliance holds outside the HTTP request path.';

comment on column public.deal_payout_block_requests.status is
  'pending = retry required, applied = hold successfully applied onchain, non_actionable = retry not needed (for example terminal deal / invalid state transition).';

create index if not exists idx_deal_payout_block_requests_status
  on public.deal_payout_block_requests (status);

create index if not exists idx_deal_payout_block_requests_deal_id
  on public.deal_payout_block_requests (deal_id);

create unique index if not exists idx_deal_payout_block_requests_pending_unique
  on public.deal_payout_block_requests (deal_id, blocked, source)
  where status = 'pending';

alter table public.deal_payout_block_requests enable row level security;
