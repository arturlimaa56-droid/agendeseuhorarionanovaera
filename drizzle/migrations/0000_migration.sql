create extension if not exists pgcrypto with schema extensions;

create table public.barber_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  barber_id text,
  is_master boolean not null default false,
  fb_email text,
  fb_pass text,
  created_at timestamptz not null default now()
);
create unique index barber_accounts_name_idx on public.barber_accounts (lower(name));
grant all on public.barber_accounts to service_role;
alter table public.barber_accounts enable row level security;

create table public.barber_sessions (
  token text primary key,
  account_id uuid not null references public.barber_accounts(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '12 hours'
);
grant all on public.barber_sessions to service_role;
alter table public.barber_sessions enable row level security;

insert into public.barber_accounts (name, pin_hash, barber_id, is_master, fb_email, fb_pass) values
 ('Arthur Lima', extensions.crypt('1389', extensions.gen_salt('bf')), null, true, 'nicolas@novaera-barbearia.app', '1389-novaera'),
 ('Nicolas Lima', extensions.crypt('1389', extensions.gen_salt('bf')), 'b2', false, 'nicolas@novaera-barbearia.app', '1389-novaera'),
 ('Biel', extensions.crypt('1010', extensions.gen_salt('bf')), 'b1', false, 'biel@novaera-barbearia.app', '1010-novaera');

create or replace function public.ne_login(_name text, _pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare a public.barber_accounts; t text;
begin
  select * into a from barber_accounts where lower(name) = lower(trim(_name));
  if a.id is null or a.pin_hash <> crypt(_pin, a.pin_hash) then return null; end if;
  delete from barber_sessions where expires_at < now();
  t := encode(gen_random_bytes(32), 'hex');
  insert into barber_sessions(token, account_id) values (t, a.id);
  return json_build_object('token', t, 'name', a.name, 'b', a.barber_id, 'master', a.is_master, 'email', a.fb_email, 'fbPass', a.fb_pass);
end $$;

create or replace function public.ne_master(_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from barber_sessions s join barber_accounts a on a.id = s.account_id
    where s.token = _token and s.expires_at > now() and a.is_master)
$$;

create or replace function public.ne_list(_token text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not ne_master(_token) then raise exception 'forbidden'; end if;
  return (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'master', is_master) order by is_master desc, name), '[]') from barber_accounts);
end $$;

create or replace function public.ne_set_pin(_token text, _id uuid, _pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not ne_master(_token) then raise exception 'forbidden'; end if;
  if length(trim(_pin)) < 4 then raise exception 'pin too short'; end if;
  update barber_accounts set pin_hash = crypt(trim(_pin), gen_salt('bf')) where id = _id;
  delete from barber_sessions where account_id = _id and token <> _token;
end $$;

create or replace function public.ne_delete(_token text, _id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not ne_master(_token) then raise exception 'forbidden'; end if;
  delete from barber_accounts where id = _id and not is_master;
end $$;

revoke all on function public.ne_login(text,text), public.ne_master(text), public.ne_list(text), public.ne_set_pin(text,uuid,text), public.ne_delete(text,uuid) from public, anon, authenticated;
grant execute on function public.ne_login(text,text), public.ne_master(text), public.ne_list(text), public.ne_set_pin(text,uuid,text), public.ne_delete(text,uuid) to service_role;