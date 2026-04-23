alter table public.sessions
  add column if not exists is_admin boolean not null default false;
