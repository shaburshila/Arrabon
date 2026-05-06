alter table public.processed_transactions
  add column if not exists hold_applied boolean null default null;

comment on column public.processed_transactions.hold_applied is
  'Three-state funding hold sync flag: null = no hold needed or no longer applicable, false = hold required but pending, true = hold successfully applied.';
