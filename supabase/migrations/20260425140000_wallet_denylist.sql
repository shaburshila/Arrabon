create table if not exists public.wallet_denylist (
  wallet text primary key check (wallet = lower(wallet)),
  reason text not null check (reason in ('fraud', 'abuse', 'sanctions', 'other')),
  added_by_wallet text not null,
  added_at timestamptz not null default timezone('utc', now()),
  notes text null
);

alter table public.wallet_denylist enable row level security;

comment on table public.wallet_denylist is 'Admin-managed wallet denylist used by compliance screening.';
comment on column public.wallet_denylist.wallet is 'Lowercase wallet address blocked by local compliance policy.';
