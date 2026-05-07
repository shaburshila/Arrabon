create table if not exists public.deal_risk_recompute_requests (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  source text not null check (
    source in (
      'post_funding_sync',
      'funding_prepare',
      'link_create',
      'lifecycle_complete',
      'lifecycle_release',
      'lifecycle_auto_release',
      'admin_resolve_release',
      'admin_resolve_refund'
    )
  ),
  status text not null default 'pending' check (status in ('pending', 'applied')),
  applied_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.deal_risk_recompute_requests is
  'Deferred risk-status recompute requests used to recover from partial compliance-check persistence or recompute failures.';

comment on column public.deal_risk_recompute_requests.status is
  'pending = recompute retry required, applied = recompute completed successfully for this screening run.';

create index if not exists idx_deal_risk_recompute_requests_status
  on public.deal_risk_recompute_requests (status);

create index if not exists idx_deal_risk_recompute_requests_deal_id
  on public.deal_risk_recompute_requests (deal_id);

create unique index if not exists idx_deal_risk_recompute_requests_pending_unique
  on public.deal_risk_recompute_requests (deal_id, source)
  where status = 'pending';

alter table public.deal_risk_recompute_requests enable row level security;
