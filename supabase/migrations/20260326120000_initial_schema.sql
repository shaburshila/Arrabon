create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  wallet text not null unique,
  username text null,
  avatar_url text null,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.users is 'Wallet-bound backend user profile record for auth/session binding.';

create table if not exists public.consultation_links (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.users(id),
  expert_address text not null,
  title text not null,
  description text not null,
  price_usdc numeric(18, 6) not null,
  scheduled_at timestamptz not null,
  timezone text not null,
  expires_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  meeting_url_encrypted text not null,
  link_hash text not null unique,
  status text not null check (status in ('Draft', 'Open', 'Expired', 'Cancelled', 'Consumed')),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.consultation_links is 'Consultation link metadata stored offchain. Timestamps are stored in UTC.';
comment on column public.consultation_links.timezone is 'Display-only timezone identifier for the consultation slot.';
comment on column public.consultation_links.link_hash is 'Single-use link hash mirrored offchain for chain/DB consistency.';

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  consultation_link_id uuid not null unique references public.consultation_links(id),
  onchain_deal_id text not null unique,
  buyer_address text not null,
  seller_address text not null,
  status text not null check (status in ('Funded', 'ConfirmPending', 'Released', 'Refunded', 'Disputed')),
  funded_at timestamptz null,
  completed_at timestamptz null,
  released_at timestamptz null,
  tx_hash text null,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.deals is 'Chain-synced deal read model. seller_address is intentionally denormalized for auth/reveal checks.';

create table if not exists public.processed_transactions (
  tx_hash text primary key,
  event_type text not null,
  deal_id uuid null references public.deals(id),
  processed_at timestamptz not null default timezone('utc', now())
);

comment on table public.processed_transactions is 'Idempotency ledger for processed chain transactions.';

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor_address text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.audit_log is 'Append-only backend audit trail.';

create table if not exists public.auth_nonces (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  nonce text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.auth_nonces is 'Single-use SIWE nonces. Support table for auth flow implementation.';

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz null
);

comment on table public.sessions is 'Backend session storage. Plaintext tokens must never be stored.';

create index if not exists idx_consultation_links_expert_address
  on public.consultation_links (expert_address);

create index if not exists idx_consultation_links_creator_user_id
  on public.consultation_links (creator_user_id);

create index if not exists idx_consultation_links_status
  on public.consultation_links (status);

create index if not exists idx_users_wallet
  on public.users (wallet);

create index if not exists idx_deals_seller_address
  on public.deals (seller_address);

create index if not exists idx_deals_buyer_address
  on public.deals (buyer_address);

create index if not exists idx_deals_status
  on public.deals (status);

create index if not exists idx_auth_nonces_wallet
  on public.auth_nonces (wallet);

create index if not exists idx_sessions_wallet
  on public.sessions (wallet);

alter table public.users enable row level security;
alter table public.consultation_links enable row level security;
alter table public.deals enable row level security;
alter table public.processed_transactions enable row level security;
alter table public.audit_log enable row level security;
alter table public.auth_nonces enable row level security;
alter table public.sessions enable row level security;
