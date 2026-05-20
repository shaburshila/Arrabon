drop function if exists public.advance_deal_event_sync_cursor(text, bigint);

create or replace function public.advance_deal_event_sync_cursor(
  p_name text,
  p_last_indexed_block bigint
)
returns table (
  cursor_name text,
  last_indexed_block bigint,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.deal_event_sync_cursors (name, last_indexed_block)
  values (p_name, p_last_indexed_block)
  on conflict (name) do update
  set
    last_indexed_block = greatest(
      public.deal_event_sync_cursors.last_indexed_block,
      excluded.last_indexed_block
    ),
    updated_at = timezone('utc', now());

  return query
  select
    cursor_row.name as cursor_name,
    cursor_row.last_indexed_block,
    cursor_row.updated_at
  from public.deal_event_sync_cursors cursor_row
  where cursor_row.name = p_name;
end;
$$;
