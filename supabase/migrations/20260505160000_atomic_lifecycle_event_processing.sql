create or replace function public.process_confirmed_completed_event_once(
  p_onchain_deal_id text,
  p_completed_at timestamptz,
  p_tx_hash text,
  p_event_type text
)
returns table (
  deal_id uuid,
  already_processed boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deal public.deals%rowtype;
  v_marker_tx_hash text;
begin
  insert into public.processed_transactions (
    tx_hash,
    event_type,
    deal_id
  )
  values (
    p_tx_hash,
    p_event_type,
    null
  )
  on conflict (tx_hash) do nothing
  returning tx_hash into v_marker_tx_hash;

  if v_marker_tx_hash is null then
    select processed.deal_id
    into process_confirmed_completed_event_once.deal_id
    from public.processed_transactions processed
    where processed.tx_hash = p_tx_hash;

    process_confirmed_completed_event_once.already_processed := true;
    return next;
    return;
  end if;

  select *
  into v_deal
  from public.deals
  where onchain_deal_id = p_onchain_deal_id
  for update;

  if not found then
    raise exception 'Deal not found for onchain deal id: %', p_onchain_deal_id;
  end if;

  if v_deal.status in ('ConfirmPending', 'Released', 'Disputed')
    and v_deal.completed_at is not null then
    update public.processed_transactions
    set deal_id = v_deal.id
    where tx_hash = p_tx_hash;

    process_confirmed_completed_event_once.deal_id := v_deal.id;
    process_confirmed_completed_event_once.already_processed := false;
    return next;
    return;
  end if;

  if v_deal.status <> 'Funded' then
    raise exception
      'Invalid deal status transition for %: % -> ConfirmPending.',
      p_onchain_deal_id,
      v_deal.status;
  end if;

  update public.deals
  set completed_at = p_completed_at,
      status = 'ConfirmPending'
  where id = v_deal.id
  returning *
  into v_deal;

  update public.processed_transactions
  set deal_id = v_deal.id
  where tx_hash = p_tx_hash;

  process_confirmed_completed_event_once.deal_id := v_deal.id;
  process_confirmed_completed_event_once.already_processed := false;
  return next;
end;
$$;

create or replace function public.process_confirmed_released_event_once(
  p_onchain_deal_id text,
  p_released_at timestamptz,
  p_tx_hash text,
  p_event_type text
)
returns table (
  deal_id uuid,
  already_processed boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_admin_wallet text;
  v_deal public.deals%rowtype;
  v_marker_tx_hash text;
  v_resolution_type text;
begin
  insert into public.processed_transactions (
    tx_hash,
    event_type,
    deal_id
  )
  values (
    p_tx_hash,
    p_event_type,
    null
  )
  on conflict (tx_hash) do nothing
  returning tx_hash into v_marker_tx_hash;

  if v_marker_tx_hash is null then
    select processed.deal_id
    into process_confirmed_released_event_once.deal_id
    from public.processed_transactions processed
    where processed.tx_hash = p_tx_hash;

    process_confirmed_released_event_once.already_processed := true;
    return next;
    return;
  end if;

  select *
  into v_deal
  from public.deals
  where onchain_deal_id = p_onchain_deal_id
  for update;

  if not found then
    raise exception 'Deal not found for onchain deal id: %', p_onchain_deal_id;
  end if;

  if v_deal.status = 'Released' and v_deal.released_at is not null then
    update public.processed_transactions
    set deal_id = v_deal.id
    where tx_hash = p_tx_hash;

    process_confirmed_released_event_once.deal_id := v_deal.id;
    process_confirmed_released_event_once.already_processed := false;
    return next;
    return;
  end if;

  if v_deal.status not in ('ConfirmPending', 'Disputed') then
    raise exception
      'Invalid deal status transition for %: % -> Released.',
      p_onchain_deal_id,
      v_deal.status;
  end if;

  with target as (
    select id
    from public.admin_resolution_intents
    where onchain_deal_id = p_onchain_deal_id
      and resolution = 'release'
      and consumed_at is null
    order by created_at desc
    limit 1
    for update
  )
  update public.admin_resolution_intents intents
  set consumed_at = timezone('utc', now())
  from target
  where intents.id = target.id
    and intents.consumed_at is null
  returning intents.admin_wallet
  into v_admin_wallet;

  v_resolution_type := case
    when v_deal.status = 'Disputed' then 'admin_release'
    when v_deal.completed_at is null then 'buyer_confirmed'
    when p_released_at > (v_deal.completed_at + interval '48 hours') then 'auto_release'
    else 'buyer_confirmed'
  end;

  update public.deals
  set released_at = p_released_at,
      resolution_type = v_resolution_type,
      resolved_at = p_released_at,
      resolved_by_wallet = coalesce(v_admin_wallet, null),
      resolved_from_status = v_deal.status,
      status = 'Released'
  where id = v_deal.id
  returning *
  into v_deal;

  update public.processed_transactions
  set deal_id = v_deal.id
  where tx_hash = p_tx_hash;

  process_confirmed_released_event_once.deal_id := v_deal.id;
  process_confirmed_released_event_once.already_processed := false;
  return next;
end;
$$;

create or replace function public.process_confirmed_disputed_event_once(
  p_onchain_deal_id text,
  p_tx_hash text,
  p_event_type text
)
returns table (
  deal_id uuid,
  already_processed boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deal public.deals%rowtype;
  v_marker_tx_hash text;
begin
  insert into public.processed_transactions (
    tx_hash,
    event_type,
    deal_id
  )
  values (
    p_tx_hash,
    p_event_type,
    null
  )
  on conflict (tx_hash) do nothing
  returning tx_hash into v_marker_tx_hash;

  if v_marker_tx_hash is null then
    select processed.deal_id
    into process_confirmed_disputed_event_once.deal_id
    from public.processed_transactions processed
    where processed.tx_hash = p_tx_hash;

    process_confirmed_disputed_event_once.already_processed := true;
    return next;
    return;
  end if;

  select *
  into v_deal
  from public.deals
  where onchain_deal_id = p_onchain_deal_id
  for update;

  if not found then
    raise exception 'Deal not found for onchain deal id: %', p_onchain_deal_id;
  end if;

  if v_deal.status = 'Disputed' then
    update public.processed_transactions
    set deal_id = v_deal.id
    where tx_hash = p_tx_hash;

    process_confirmed_disputed_event_once.deal_id := v_deal.id;
    process_confirmed_disputed_event_once.already_processed := false;
    return next;
    return;
  end if;

  if v_deal.status not in ('ConfirmPending', 'Funded') then
    raise exception
      'Invalid deal status transition for %: % -> Disputed.',
      p_onchain_deal_id,
      v_deal.status;
  end if;

  update public.deals
  set status = 'Disputed'
  where id = v_deal.id
  returning *
  into v_deal;

  update public.processed_transactions
  set deal_id = v_deal.id
  where tx_hash = p_tx_hash;

  process_confirmed_disputed_event_once.deal_id := v_deal.id;
  process_confirmed_disputed_event_once.already_processed := false;
  return next;
end;
$$;

create or replace function public.process_confirmed_refunded_event_once(
  p_onchain_deal_id text,
  p_tx_hash text,
  p_event_type text
)
returns table (
  deal_id uuid,
  already_processed boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_admin_wallet text;
  v_deal public.deals%rowtype;
  v_marker_tx_hash text;
  v_resolved_at timestamptz;
begin
  insert into public.processed_transactions (
    tx_hash,
    event_type,
    deal_id
  )
  values (
    p_tx_hash,
    p_event_type,
    null
  )
  on conflict (tx_hash) do nothing
  returning tx_hash into v_marker_tx_hash;

  if v_marker_tx_hash is null then
    select processed.deal_id
    into process_confirmed_refunded_event_once.deal_id
    from public.processed_transactions processed
    where processed.tx_hash = p_tx_hash;

    process_confirmed_refunded_event_once.already_processed := true;
    return next;
    return;
  end if;

  select *
  into v_deal
  from public.deals
  where onchain_deal_id = p_onchain_deal_id
  for update;

  if not found then
    raise exception 'Deal not found for onchain deal id: %', p_onchain_deal_id;
  end if;

  if v_deal.status = 'Refunded' then
    update public.processed_transactions
    set deal_id = v_deal.id
    where tx_hash = p_tx_hash;

    process_confirmed_refunded_event_once.deal_id := v_deal.id;
    process_confirmed_refunded_event_once.already_processed := false;
    return next;
    return;
  end if;

  if v_deal.status <> 'Disputed' then
    raise exception
      'Invalid deal status transition for %: % -> Refunded.',
      p_onchain_deal_id,
      v_deal.status;
  end if;

  with target as (
    select id
    from public.admin_resolution_intents
    where onchain_deal_id = p_onchain_deal_id
      and resolution = 'refund'
      and consumed_at is null
    order by created_at desc
    limit 1
    for update
  )
  update public.admin_resolution_intents intents
  set consumed_at = timezone('utc', now())
  from target
  where intents.id = target.id
    and intents.consumed_at is null
  returning intents.admin_wallet
  into v_admin_wallet;

  v_resolved_at := timezone('utc', now());

  update public.deals
  set resolution_type = 'admin_refund',
      resolved_at = v_resolved_at,
      resolved_by_wallet = coalesce(v_admin_wallet, null),
      resolved_from_status = v_deal.status,
      status = 'Refunded'
  where id = v_deal.id
  returning *
  into v_deal;

  update public.processed_transactions
  set deal_id = v_deal.id
  where tx_hash = p_tx_hash;

  process_confirmed_refunded_event_once.deal_id := v_deal.id;
  process_confirmed_refunded_event_once.already_processed := false;
  return next;
end;
$$;
