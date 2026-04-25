create table if not exists public.compliance_checks (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('wallet', 'transaction')),
  subject_value text not null check (subject_value = lower(subject_value)),
  provider text not null,
  result text not null check (result in ('Clear', 'Review', 'Blocked')),
  reason_code text not null check (
    reason_code in (
      'NO_HIT',
      'OFAC_SANCTIONS',
      'USDC_BLACKLISTED',
      'LOCAL_DENYLIST',
      'PROVIDER_UNAVAILABLE',
      'FRAUD_SIGNAL'
    )
  ),
  raw_summary jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default timezone('utc', now()),
  deal_id uuid null references public.deals(id),
  actor_wallet text null
);

alter table public.compliance_checks enable row level security;

create index if not exists idx_compliance_checks_subject_lookup
  on public.compliance_checks (subject_type, subject_value);

create index if not exists idx_compliance_checks_deal_id
  on public.compliance_checks (deal_id)
  where deal_id is not null;

comment on table public.compliance_checks is 'Append-only compliance screening audit trail for wallets and transactions.';
comment on column public.compliance_checks.subject_value is 'Normalized lowercase wallet address or transaction hash used for compliance lookups.';

alter table public.deals
  add column if not exists risk_status text;

update public.deals
set risk_status = 'Clear'
where risk_status is null;

alter table public.deals
  alter column risk_status set default 'Clear';

alter table public.deals
  alter column risk_status set not null;

alter table public.deals
  add constraint deals_risk_status_check
  check (risk_status in ('Clear', 'Review', 'Blocked'));

comment on column public.deals.risk_status is 'Deal-level compliance risk status derived from the worst-case compliance history.';

create or replace function public.prevent_compliance_checks_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'compliance_checks is append-only';
end;
$$;

create trigger prevent_compliance_checks_update_or_delete
  before update or delete on public.compliance_checks
  for each row
  execute function public.prevent_compliance_checks_mutation();

create or replace function public.enforce_deals_risk_status_monotonicity()
returns trigger
language plpgsql
as $$
declare
  aml_override_enabled boolean := coalesce(current_setting('app.aml_override', true), 'off') = 'on';
begin
  if aml_override_enabled then
    return new;
  end if;

  if new.risk_status = old.risk_status then
    return new;
  end if;

  if old.risk_status = 'Clear' and new.risk_status in ('Review', 'Blocked') then
    return new;
  end if;

  if old.risk_status = 'Review' and new.risk_status = 'Blocked' then
    return new;
  end if;

  raise exception 'invalid risk_status transition from % to %', old.risk_status, new.risk_status;
end;
$$;

create trigger enforce_deals_risk_status_monotonicity
  before update on public.deals
  for each row
  execute function public.enforce_deals_risk_status_monotonicity();
