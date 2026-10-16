-- Profils et abonnements.
-- Seuls les comptes RELIÉS (non anonymes) ont un profil ou des abonnements : chaque fonction refuse une session anonyme.
-- Règle de visibilité : un profil complet (bio, paroisse, compteurs) est visible par son propriétaire et par les
-- personnes que le propriétaire suit. Suivre quelqu'un lui ouvre donc TON profil ; il n'y a pas de demande d'acceptation.
-- Toute la règle tient dans can_see_profile : c'est la seule fonction à compléter si elle s'élargit.
-- Les tables ne sont pas lisibles directement (RLS sans politique, droits retirés) : tout passe par les fonctions ci-dessous.
--
-- delete_my_account (004) : supprimer auth.users emporte profiles et follows par on delete cascade
--   (le profil, ses abonnements et ses abonnés). Rien à modifier.
-- adopt_account (002/003) : rien à changer, une session anonyme n'a ni profil ni abonnement à déplacer.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  bio text,
  parish text,
  charter_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_fmt check (
    handle ~ '^[a-z0-9_.]{3,20}$' and left(handle, 1) <> '.' and right(handle, 1) <> '.'
  ),
  constraint profiles_display_name_len check (char_length(trim(display_name)) between 1 and 40),
  constraint profiles_bio_len check (bio is null or char_length(bio) <= 160),
  constraint profiles_parish_len check (parish is null or char_length(parish) <= 80)
);

create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.follows from anon, authenticated;

-- Le suivi compte dans la limite quotidienne, comme les échos et les intentions.
-- La contrainte de 001 n'a pas de nom explicite : on la remplace proprement.
alter table public.daily_posts drop constraint if exists daily_posts_kind_check;
alter table public.daily_posts
  add constraint daily_posts_kind_check check (kind in ('echo', 'intention', 'follow'));

-- Utilisateur relié (non anonyme), sinon 'auth'. Interne : pas de droit d'exécution pour les clients.
create or replace function public.linked_uid()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'auth';
  end if;
  return uid;
end;
$$;

-- Le profil complet de p_owner est-il visible par p_viewer ? Le propriétaire, et ceux qu'il suit.
-- Interne : pas de droit d'exécution pour les clients.
create or replace function public.can_see_profile(p_viewer uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_viewer is not null and p_owner is not null and (
    p_viewer = p_owner
    or exists (select 1 from follows f where f.follower_id = p_owner and f.followee_id = p_viewer)
  );
$$;

-- Pseudo valide et non réservé. Interne.
create or replace function public.handle_ok(p_handle text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_handle ~ '^[a-z0-9_.]{3,20}$'
    and left(p_handle, 1) <> '.'
    and right(p_handle, 1) <> '.'
    and p_handle not in ('admin', 'manne', 'support', 'moderation', 'equipe');
$$;

create or replace function public.get_my_profile()
returns table (handle text, display_name text, bio text, parish text, followers integer, following_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  return query
  select
    p.handle,
    p.display_name,
    p.bio,
    p.parish,
    (select count(*)::integer from follows f where f.followee_id = p.id),
    (select count(*)::integer from follows f where f.follower_id = p.id)
  from profiles p
  where p.id = uid;
end;
$$;

-- Crée (charte acceptée exigée) ou met à jour son profil.
create or replace function public.save_my_profile(
  p_handle text,
  p_display_name text,
  p_bio text,
  p_parish text,
  p_accept_charter boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(trim(coalesce(p_handle, '')));
  dn text := trim(coalesce(p_display_name, ''));
  b text := nullif(trim(coalesce(p_bio, '')), '');
  par text := nullif(trim(coalesce(p_parish, '')), '');
begin
  if not public.handle_ok(h) then
    raise exception 'pseudo';
  end if;
  if char_length(dn) < 1 or char_length(dn) > 40
    or char_length(coalesce(b, '')) > 160 or char_length(coalesce(par, '')) > 80 then
    raise exception 'longueur';
  end if;

  if exists (select 1 from profiles where id = uid) then
    update profiles
    set handle = h, display_name = dn, bio = b, parish = par, updated_at = now()
    where id = uid;
  else
    if p_accept_charter is distinct from true then
      raise exception 'charte';
    end if;
    insert into profiles (id, handle, display_name, bio, parish, charter_accepted_at)
    values (uid, h, dn, b, par, now());
  end if;
exception
  when unique_violation then
    raise exception 'Ce pseudo est déjà pris';
end;
$$;

-- Le pseudo est-il utilisable par moi ? Le mien compte comme libre.
create or replace function public.handle_available(p_handle text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(trim(coalesce(p_handle, '')));
begin
  if not public.handle_ok(h) then
    return false;
  end if;
  return not exists (select 1 from profiles p where p.handle = h and p.id <> uid);
end;
$$;

-- Recherche par pseudo exact : une carte minimale, jamais la bio ni la paroisse.
create or replace function public.find_profile(p_handle text)
returns table (handle text, display_name text, following boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(trim(coalesce(p_handle, '')));
begin
  return query
  select
    p.handle,
    p.display_name,
    exists (select 1 from follows f where f.follower_id = uid and f.followee_id = p.id)
  from profiles p
  where p.handle = h;
end;
$$;

-- Le profil d'un pseudo exact. Bio, paroisse et compteurs ne sortent que si can_see_profile l'autorise.
create or replace function public.get_profile(p_handle text)
returns table (
  handle text,
  display_name text,
  bio text,
  parish text,
  followers integer,
  following_count integer,
  i_follow boolean,
  follows_me boolean,
  visible boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(trim(coalesce(p_handle, '')));
begin
  return query
  select
    p.handle,
    p.display_name,
    case when v.ok then p.bio end,
    case when v.ok then p.parish end,
    case when v.ok then (select count(*)::integer from follows f where f.followee_id = p.id) end,
    case when v.ok then (select count(*)::integer from follows f where f.follower_id = p.id) end,
    exists (select 1 from follows f where f.follower_id = uid and f.followee_id = p.id),
    exists (select 1 from follows f where f.follower_id = p.id and f.followee_id = uid),
    v.ok
  from profiles p
  cross join lateral (select public.can_see_profile(uid, p.id) as ok) v
  where p.handle = h;
end;
$$;

create or replace function public.follow(p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(trim(coalesce(p_handle, '')));
  target uuid;
  n integer;
  added integer;
begin
  -- Suivre ouvre ton profil : il faut donc en avoir un.
  if not exists (select 1 from profiles where id = uid) then
    raise exception 'profil';
  end if;
  select p.id into target from profiles p where p.handle = h;
  if target is null then
    raise exception 'introuvable';
  end if;
  if target = uid then
    raise exception 'propre';
  end if;
  if exists (select 1 from follows f where f.follower_id = uid and f.followee_id = target) then
    return;
  end if;
  select count(*) into n from daily_posts
  where user_id = uid and kind = 'follow' and created_at > now() - interval '1 day';
  if n >= 50 then
    raise exception 'Trop d’abonnements pour aujourd’hui';
  end if;
  insert into follows (follower_id, followee_id) values (uid, target) on conflict do nothing;
  get diagnostics added = row_count;
  if added > 0 then
    insert into daily_posts (user_id, kind) values (uid, 'follow');
  end if;
end;
$$;

create or replace function public.unfollow(p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(trim(coalesce(p_handle, '')));
begin
  delete from follows f
  using profiles p
  where p.handle = h and f.follower_id = uid and f.followee_id = p.id;
end;
$$;

-- Ceux que je suis.
create or replace function public.list_following()
returns table (handle text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  return query
  select p.handle, p.display_name
  from follows f
  join profiles p on p.id = f.followee_id
  where f.follower_id = uid
  order by f.created_at desc
  limit 200;
end;
$$;

-- Ceux qui me suivent : en me suivant, ils m'ont ouvert leur profil, leur carte est donc visible.
create or replace function public.list_followers()
returns table (handle text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  return query
  select p.handle, p.display_name
  from follows f
  join profiles p on p.id = f.follower_id
  where f.followee_id = uid
  order by f.created_at desc
  limit 200;
end;
$$;

revoke all on function public.linked_uid() from public, anon, authenticated;
revoke all on function public.can_see_profile(uuid, uuid) from public, anon, authenticated;
revoke all on function public.handle_ok(text) from public, anon, authenticated;
revoke all on function public.get_my_profile() from public, anon, authenticated;
revoke all on function public.save_my_profile(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.handle_available(text) from public, anon, authenticated;
revoke all on function public.find_profile(text) from public, anon, authenticated;
revoke all on function public.get_profile(text) from public, anon, authenticated;
revoke all on function public.follow(text) from public, anon, authenticated;
revoke all on function public.unfollow(text) from public, anon, authenticated;
revoke all on function public.list_following() from public, anon, authenticated;
revoke all on function public.list_followers() from public, anon, authenticated;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.save_my_profile(text, text, text, text, boolean) to authenticated;
grant execute on function public.handle_available(text) to authenticated;
grant execute on function public.find_profile(text) to authenticated;
grant execute on function public.get_profile(text) to authenticated;
grant execute on function public.follow(text) to authenticated;
grant execute on function public.unfollow(text) to authenticated;
grant execute on function public.list_following() to authenticated;
grant execute on function public.list_followers() to authenticated;
