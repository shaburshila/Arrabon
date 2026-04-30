create or replace function public.consume_latest_admin_resolution_intent(
  p_onchain_deal_id text,
  p_resolution text
)
returns setof public.admin_resolution_intents
language sql
security invoker
set search_path = public
as $$
  with target as (
    select id
    from public.admin_resolution_intents
    where onchain_deal_id = p_onchain_deal_id
      and resolution = p_resolution
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
  returning intents.*;
$$;
