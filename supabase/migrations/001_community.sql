-- Communauté Manne : j'aime, échos, intentions.
-- À appliquer sur le projet Supabase. Dans Authentication > Providers, activer les connexions anonymes.
-- L'app n'utilise que la clé anonyme : chaque écriture passe par RLS ou par une fonction qui vérifie auth.uid().

create table public.likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  target text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target),
  constraint likes_target_fmt check (target ~ '^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}:[1-9][0-9]{0,2}-[1-9][0-9]{0,2}$')
);

create table public.like_counts (
  target text primary key,
  count integer not null default 0
);

create table public.echoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target text not null,
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, target),
  constraint echoes_target_fmt check (target ~ '^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}:[1-9][0-9]{0,2}-[1-9][0-9]{0,2}$'),
  constraint echoes_body_len check (char_length(body) between 1 and 240)
);

create table public.intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  constraint intentions_body_len check (char_length(body) between 1 and 280)
);

create table public.carries (
  user_id uuid not null references auth.users (id) on delete cascade,
  intention_id uuid not null references public.intentions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, intention_id)
);

create table public.carry_counts (
  intention_id uuid primary key references public.intentions (id) on delete cascade,
  count integer not null default 0
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  echo_id uuid references public.echoes (id) on delete cascade,
  intention_id uuid references public.intentions (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint reports_one_subject check (
    (echo_id is not null and intention_id is null)
    or (echo_id is null and intention_id is not null)
  ),
  unique (user_id, echo_id),
  unique (user_id, intention_id)
);

-- Compte les publications même après suppression, pour la limite quotidienne.
create table public.daily_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  kind text not null check (kind in ('echo', 'intention')),
  created_at timestamptz not null default now()
);

create index echoes_target_idx on public.echoes (target) where not hidden;
create index intentions_open_idx on public.intentions (created_at desc) where withdrawn_at is null;
create index daily_posts_user_idx on public.daily_posts (user_id, created_at);

alter table public.likes enable row level security;
alter table public.like_counts enable row level security;
alter table public.echoes enable row level security;
alter table public.intentions enable row level security;
alter table public.carries enable row level security;
alter table public.carry_counts enable row level security;
alter table public.reports enable row level security;
alter table public.daily_posts enable row level security;

-- Chacun ne voit et n'écrit que ses j'aime. Le nombre public est dans like_counts, lu via community_stats.
create policy likes_select_own on public.likes
  for select to authenticated
  using (user_id = auth.uid());

create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy likes_delete_own on public.likes
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.likes from anon, authenticated;
revoke all on table public.like_counts from anon, authenticated;
revoke all on table public.echoes from anon, authenticated;
revoke all on table public.intentions from anon, authenticated;
revoke all on table public.carries from anon, authenticated;
revoke all on table public.carry_counts from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.daily_posts from anon, authenticated;

grant select, insert, delete on table public.likes to authenticated;

create or replace function public.sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into like_counts (target, count) values (new.target, 1)
    on conflict (target) do update set count = like_counts.count + 1;
    return new;
  end if;
  update like_counts set count = greatest(0, count - 1) where target = old.target;
  return old;
end;
$$;

create trigger likes_count
  after insert or delete on public.likes
  for each row execute function public.sync_like_count();

create or replace function public.sync_carry_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into carry_counts (intention_id, count) values (new.intention_id, 1)
    on conflict (intention_id) do update set count = carry_counts.count + 1;
    return new;
  end if;
  update carry_counts set count = greatest(0, count - 1) where intention_id = old.intention_id;
  return old;
end;
$$;

create trigger carries_count
  after insert or delete on public.carries
  for each row execute function public.sync_carry_count();

create or replace function public.hide_on_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if new.echo_id is not null then
    select count(*) into n from reports where echo_id = new.echo_id;
    if n >= 3 then
      update echoes set hidden = true where id = new.echo_id;
    end if;
  elsif new.intention_id is not null then
    select count(*) into n from reports where intention_id = new.intention_id;
    if n >= 3 then
      update intentions set withdrawn_at = now() where id = new.intention_id and withdrawn_at is null;
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_hide
  after insert on public.reports
  for each row execute function public.hide_on_reports();

create or replace function public.community_stats(targets text[])
returns table (target text, likes integer, echoes integer, liked boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth';
  end if;
  if targets is null or cardinality(targets) > 30 then
    raise exception 'too_many';
  end if;
  return query
  select
    t.target,
    coalesce(c.count, 0)::integer,
    coalesce(e.n, 0)::integer,
    exists (select 1 from likes l where l.target = t.target and l.user_id = auth.uid())
  from unnest(targets) as t(target)
  left join like_counts c on c.target = t.target
  left join lateral (
    select count(*)::integer as n from echoes where echoes.target = t.target and not echoes.hidden
  ) e on true;
end;
$$;

create or replace function public.post_echo(p_target text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := trim(p_body);
  existing_id uuid;
  existing_hidden boolean;
  n integer;
  new_id uuid;
begin
  if uid is null then
    raise exception 'auth';
  end if;
  if p_target !~ '^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}:[1-9][0-9]{0,2}-[1-9][0-9]{0,2}$' then
    raise exception 'cible';
  end if;
  if char_length(clean) < 1 or char_length(clean) > 240 then
    raise exception 'longueur';
  end if;

  select id, hidden into existing_id, existing_hidden from echoes where user_id = uid and target = p_target;
  if found then
    if existing_hidden then
      raise exception 'Cet écho a été retiré';
    end if;
    update echoes set body = clean where id = existing_id;
    return existing_id;
  end if;

  select count(*) into n from daily_posts
  where user_id = uid and kind = 'echo' and created_at > now() - interval '1 day';
  if n >= 8 then
    raise exception 'Trop d’échos pour aujourd’hui';
  end if;

  insert into echoes (user_id, target, body) values (uid, p_target, clean) returning id into new_id;
  insert into daily_posts (user_id, kind) values (uid, 'echo');
  return new_id;
end;
$$;

create or replace function public.list_echoes(p_target text)
returns table (id uuid, body text, created_at timestamptz, mine boolean, hidden boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth';
  end if;
  return query
  select e.id, e.body, e.created_at, e.user_id = auth.uid(), e.hidden
  from echoes e
  where e.target = p_target and (not e.hidden or e.user_id = auth.uid())
  order by e.created_at desc
  limit 50;
end;
$$;

create or replace function public.delete_echo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth';
  end if;
  delete from echoes where id = p_id and user_id = auth.uid();
end;
$$;

create or replace function public.report_echo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'auth';
  end if;
  if exists (select 1 from echoes where id = p_id and user_id = uid) then
    raise exception 'propre';
  end if;
  if not exists (select 1 from echoes where id = p_id and not hidden) then
    raise exception 'introuvable';
  end if;
  insert into reports (user_id, echo_id) values (uid, p_id);
exception
  when unique_violation then
    raise exception 'Déjà signalé';
end;
$$;

create or replace function public.post_intention(p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := trim(p_body);
  n integer;
  new_id uuid;
begin
  if uid is null then
    raise exception 'auth';
  end if;
  if char_length(clean) < 1 or char_length(clean) > 280 then
    raise exception 'longueur';
  end if;
  select count(*) into n from daily_posts
  where user_id = uid and kind = 'intention' and created_at > now() - interval '1 day';
  if n >= 5 then
    raise exception 'Trop d’intentions pour aujourd’hui';
  end if;
  insert into intentions (user_id, body) values (uid, clean) returning id into new_id;
  insert into daily_posts (user_id, kind) values (uid, 'intention');
  return new_id;
end;
$$;

create or replace function public.list_intentions()
returns table (id uuid, body text, created_at timestamptz, mine boolean, carries integer, carrying boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth';
  end if;
  return query
  select
    i.id,
    i.body,
    i.created_at,
    i.user_id = auth.uid(),
    coalesce(c.count, 0)::integer,
    exists (select 1 from carries k where k.intention_id = i.id and k.user_id = auth.uid())
  from intentions i
  left join carry_counts c on c.intention_id = i.id
  where i.withdrawn_at is null
  order by i.created_at desc
  limit 50;
end;
$$;

create or replace function public.withdraw_intention(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth';
  end if;
  update intentions set withdrawn_at = now()
  where id = p_id and user_id = auth.uid() and withdrawn_at is null;
end;
$$;

create or replace function public.set_carry(p_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
begin
  if uid is null then
    raise exception 'auth';
  end if;
  select user_id into owner from intentions where id = p_id and withdrawn_at is null;
  if owner is null then
    raise exception 'introuvable';
  end if;
  if owner = uid then
    raise exception 'propre';
  end if;
  if p_on then
    insert into carries (user_id, intention_id) values (uid, p_id) on conflict do nothing;
  else
    delete from carries where user_id = uid and intention_id = p_id;
  end if;
end;
$$;

create or replace function public.report_intention(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'auth';
  end if;
  if exists (select 1 from intentions where id = p_id and user_id = uid) then
    raise exception 'propre';
  end if;
  if not exists (select 1 from intentions where id = p_id and withdrawn_at is null) then
    raise exception 'introuvable';
  end if;
  insert into reports (user_id, intention_id) values (uid, p_id);
exception
  when unique_violation then
    raise exception 'Déjà signalé';
end;
$$;

revoke all on function public.sync_like_count() from public, anon, authenticated;
revoke all on function public.sync_carry_count() from public, anon, authenticated;
revoke all on function public.hide_on_reports() from public, anon, authenticated;
revoke all on function public.community_stats(text[]) from public, anon, authenticated;
revoke all on function public.post_echo(text, text) from public, anon, authenticated;
revoke all on function public.list_echoes(text) from public, anon, authenticated;
revoke all on function public.delete_echo(uuid) from public, anon, authenticated;
revoke all on function public.report_echo(uuid) from public, anon, authenticated;
revoke all on function public.post_intention(text) from public, anon, authenticated;
revoke all on function public.list_intentions() from public, anon, authenticated;
revoke all on function public.withdraw_intention(uuid) from public, anon, authenticated;
revoke all on function public.set_carry(uuid, boolean) from public, anon, authenticated;
revoke all on function public.report_intention(uuid) from public, anon, authenticated;

grant execute on function public.sync_like_count() to authenticated;
grant execute on function public.sync_carry_count() to authenticated;
grant execute on function public.hide_on_reports() to authenticated;
grant execute on function public.community_stats(text[]) to authenticated;
grant execute on function public.post_echo(text, text) to authenticated;
grant execute on function public.list_echoes(text) to authenticated;
grant execute on function public.delete_echo(uuid) to authenticated;
grant execute on function public.report_echo(uuid) to authenticated;
grant execute on function public.post_intention(text) to authenticated;
grant execute on function public.list_intentions() to authenticated;
grant execute on function public.withdraw_intention(uuid) to authenticated;
grant execute on function public.set_carry(uuid, boolean) to authenticated;
grant execute on function public.report_intention(uuid) to authenticated;
