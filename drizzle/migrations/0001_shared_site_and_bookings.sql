create table public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant all on public.site_content to service_role;
alter table public.site_content enable row level security;

create table public.bookings (
  id text primary key,
  barber text not null,
  date text not null,
  time text not null,
  dur int not null default 30,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index bookings_date_idx on public.bookings(date);
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;

create or replace function public.ne_session(_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', a.id, 'b', a.barber_id, 'master', a.is_master)
  from barber_sessions s join barber_accounts a on a.id = s.account_id
  where s.token = _token and s.expires_at > now()
$$;
revoke all on function public.ne_session(text) from public, anon, authenticated;
grant execute on function public.ne_session(text) to service_role;