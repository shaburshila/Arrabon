create table if not exists public.deal_dispute_messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  author_wallet text not null,
  author_role text not null check (author_role in ('buyer', 'seller', 'admin')),
  body text not null check (char_length(trim(body)) between 1 and 3000),
  evidence_url text null check (evidence_url is null or char_length(evidence_url) <= 2048),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.deal_dispute_messages is 'Offchain dispute discussion and evidence links visible to deal participants and admins.';
comment on column public.deal_dispute_messages.evidence_url is 'Optional external evidence URL. MVP stores links only, not uploaded files.';

create index if not exists idx_deal_dispute_messages_deal_created_at
  on public.deal_dispute_messages (deal_id, created_at);

create index if not exists idx_deal_dispute_messages_author_wallet
  on public.deal_dispute_messages (author_wallet);

alter table public.deal_dispute_messages enable row level security;
