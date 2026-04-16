alter table public.deals
  add column if not exists resolution_type text null
    check (resolution_type in ('buyer_confirmed', 'auto_release', 'admin_release', 'admin_refund')),
  add column if not exists resolved_from_status text null
    check (resolved_from_status in ('Funded', 'ConfirmPending', 'Released', 'Refunded', 'Disputed')),
  add column if not exists resolved_at timestamptz null,
  add column if not exists resolved_by_wallet text null;

comment on column public.deals.resolution_type is 'How a terminal Released/Refunded state was reached.';
comment on column public.deals.resolved_from_status is 'Deal status immediately before terminal resolution.';
comment on column public.deals.resolved_at is 'Best available timestamp for the terminal resolution.';
comment on column public.deals.resolved_by_wallet is 'Wallet that initiated the resolution when known offchain.';
