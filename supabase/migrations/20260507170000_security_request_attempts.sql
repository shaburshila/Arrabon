create table if not exists public.security_request_attempts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('siwe_verify', 'meeting_url_reveal')),
  wallet_address text not null,
  deal_id uuid null references public.deals(id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint security_request_attempts_scope_deal_id_check check (
    (scope = 'siwe_verify' and deal_id is null)
    or (scope = 'meeting_url_reveal' and deal_id is not null)
  )
);

create index if not exists idx_security_request_attempts_scope_wallet_created_at
  on public.security_request_attempts (scope, wallet_address, created_at desc);

create index if not exists idx_security_request_attempts_scope_wallet_deal_created_at
  on public.security_request_attempts (scope, wallet_address, deal_id, created_at desc);

alter table public.security_request_attempts enable row level security;

comment on table public.security_request_attempts is 'Append-only rate-limit attempt ledger for sensitive auth and reveal routes.';
