create or replace function public.insert_confirmed_deal_and_maybe_consume_link(
  p_consultation_link_id uuid,
  p_onchain_deal_id text,
  p_buyer_address text,
  p_seller_address text,
  p_status text,
  p_funded_at timestamptz,
  p_tx_hash text,
  p_consume_link boolean
)
returns setof public.deals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deal public.deals%rowtype;
begin
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

  if p_consume_link then
    update public.consultation_links
    set status = 'Consumed'
    where id = p_consultation_link_id
      and status = 'Open';
  end if;

  return next v_deal;
end;
$$;
