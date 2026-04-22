create table if not exists public.admin_resolution_intents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  onchain_deal_id text not null,
  resolution text not null check (resolution in ('release', 'refund')),
  admin_wallet text not null,
  created_at timestamptz not null default timezone('utc', now()),
  consumed_at timestamptz null
);

comment on table public.admin_resolution_intents is 'Pending offchain attribution for admin dispute resolution transactions.';
comment on column public.admin_resolution_intents.admin_wallet is 'Admin wallet that prepared the resolution transaction.';

create index if not exists idx_admin_resolution_intents_active_lookup
  on public.admin_resolution_intents (onchain_deal_id, resolution, created_at desc)
  where consumed_at is null;

alter table public.admin_resolution_intents enable row level security;
