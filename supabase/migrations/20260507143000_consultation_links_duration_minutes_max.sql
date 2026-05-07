do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'duration_minutes_max'
      and conrelid = 'public.consultation_links'::regclass
  ) then
    alter table public.consultation_links
      add constraint duration_minutes_max
      check (duration_minutes <= 1440);
  end if;
end
$$;
