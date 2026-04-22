create or replace function public.process_confirmed_funded_event_once(
  p_consultation_link_id uuid,
  p_onchain_deal_id text,
  p_buyer_address text,
  p_seller_address text,
  p_status text,
  p_funded_at timestamptz,
  p_tx_hash text,
  p_event_type text,
  p_consume_link boolean
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
    into process_confirmed_funded_event_once.deal_id
    from public.processed_transactions processed
    where processed.tx_hash = p_tx_hash;

    process_confirmed_funded_event_once.already_processed := true;
    return next;
    return;
  end if;

  select *
  into v_deal
  from public.deals
  where consultation_link_id = p_consultation_link_id;

  if found then
    if v_deal.onchain_deal_id <> p_onchain_deal_id then
      raise exception
        'Consultation link % is already bound to onchain deal %.',
        p_consultation_link_id,
        v_deal.onchain_deal_id;
    end if;
  else
    select *
    into v_deal
    from public.deals
    where onchain_deal_id = p_onchain_deal_id;

    if found then
      if v_deal.consultation_link_id <> p_consultation_link_id then
        raise exception
          'Onchain deal % is already bound to consultation link %.',
          p_onchain_deal_id,
          v_deal.consultation_link_id;
      end if;
    else
      insert into public.deals (
        consultation_link_id,
        onchain_deal_id,
        buyer_address,
        seller_address,
        status,
        funded_at,
        tx_hash
      )
      values (
        p_consultation_link_id,
        p_onchain_deal_id,
        p_buyer_address,
        p_seller_address,
        p_status,
        p_funded_at,
        p_tx_hash
      )
      returning * into v_deal;
    end if;
  end if;

  if p_consume_link then
    update public.consultation_links
    set status = 'Consumed'
    where id = p_consultation_link_id
      and status = 'Open';
  end if;

  update public.processed_transactions
  set deal_id = v_deal.id
  where tx_hash = p_tx_hash;

  process_confirmed_funded_event_once.deal_id := v_deal.id;
  process_confirmed_funded_event_once.already_processed := false;
  return next;
end;
$$;
