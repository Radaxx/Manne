-- Vitrine du profil (passages, prières, intentions que l'on choisit d'afficher) et blocage.
--
-- Visibilité : la vitrine suit EXACTEMENT can_see_profile (005, complétée ici par le blocage) : le propriétaire et
-- les personnes qu'il suit. Aucune lecture de user_state. Une session anonyme n'a ni profil ni vitrine (linked_uid).
-- Rien n'est affiché par défaut. Afficher publie une COPIE côté serveur ; retirer la supprime. La donnée locale
-- reste la source : elle ne change pas quand on affiche ou qu'on retire.
--   - passages : seule la référence est stockée (livre, chapitre, versets). Le texte vient de la Bible embarquée,
--     dans la traduction de celui qui regarde ;
--   - prières : titre et texte copiés ;
--   - intentions : celles du fil existant. Une intention affichée reste anonyme dans le fil global
--     (list_intentions n'est pas modifiée) mais apparaît sur le profil, pour ceux qui peuvent le voir.
-- Les tables ne sont pas lisibles directement (RLS sans politique, droits retirés) : tout passe par les fonctions ci-dessous.
--
-- delete_my_account (004) : supprimer auth.users emporte profile_passages, profile_prayers et blocks (dans les deux
--   colonnes) par on delete cascade, et les intentions (donc leur drapeau) comme avant. Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme n'a pas de vitrine ; ses intentions adoptées gardent
--   shown_on_profile = false.
-- list_followers / list_following (005) : rien à changer. Bloquer supprime les abonnements dans les deux sens et
--   follow refuse d'en recréer, donc un bloqué n'apparaît dans aucune liste.

create table public.profile_passages (
  user_id uuid not null references auth.users (id) on delete cascade,
  book smallint not null,
  chapter smallint not null,
  verse_from smallint not null,
  verse_to smallint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, book, chapter, verse_from, verse_to),
  constraint profile_passages_book check (book between 1 and 73),
  constraint profile_passages_chapter check (chapter >= 1),
  constraint profile_passages_verses check (verse_from >= 1 and verse_to >= verse_from)
);

create table public.profile_prayers (
  user_id uuid not null references auth.users (id) on delete cascade,
  prayer_id text not null,
  title text not null,
  body text not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, prayer_id),
  constraint profile_prayers_id_len check (char_length(prayer_id) between 1 and 64),
  constraint profile_prayers_title_len check (char_length(title) between 1 and 80),
  constraint profile_prayers_body_len check (char_length(body) between 1 and 4000)
);

alter table public.intentions
  add column shown_on_profile boolean not null default false;

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.profile_passages enable row level security;
alter table public.profile_prayers enable row level security;
alter table public.blocks enable row level security;

revoke all on table public.profile_passages from anon, authenticated;
revoke all on table public.profile_prayers from anon, authenticated;
revoke all on table public.blocks from anon, authenticated;

-- L'un des deux a-t-il bloqué l'autre ? Interne : pas de droit d'exécution pour les clients.
create or replace function public.is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

-- Remplace la version de 005 : même règle (le propriétaire, et ceux qu'il suit), faux dès que l'un a bloqué l'autre.
create or replace function public.can_see_profile(p_viewer uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_viewer is not null and p_owner is not null and (
    p_viewer = p_owner
    or (
      exists (select 1 from follows f where f.follower_id = p_owner and f.followee_id = p_viewer)
      and not public.is_blocked(p_viewer, p_owner)
    )
  );
$$;

-- Recherche par pseudo exact. Un pseudo qui a bloqué l'appelant, ou que l'appelant a bloqué, ne renvoie rien
-- (comme un pseudo inconnu) ; les personnes bloquées se retrouvent dans list_blocked.
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
  where p.handle = h and not public.is_blocked(uid, p.id);
end;
$$;

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
  where p.handle = h and not public.is_blocked(uid, p.id);
end;
$$;

-- Suivre est refusé entre deux personnes dont l'une a bloqué l'autre. Si c'est l'autre qui a bloqué, le pseudo reste
-- « introuvable » : on ne révèle pas le blocage.
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
  if exists (select 1 from blocks b where b.blocker_id = target and b.blocked_id = uid) then
    raise exception 'introuvable';
  end if;
  if exists (select 1 from blocks b where b.blocker_id = uid and b.blocked_id = target) then
    raise exception 'bloquee';
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

-- Bloquer : supprime les abonnements dans les deux sens, empêche d'en recréer, ferme find_profile / get_profile
-- et la vitrine pour l'autre. Réversible avec unblock (les abonnements, eux, ne reviennent pas).
create or replace function public.block(p_handle text)
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
begin
  select p.id into target from profiles p where p.handle = h;
  if target is null then
    raise exception 'introuvable';
  end if;
  if target = uid then
    raise exception 'propre';
  end if;
  if exists (select 1 from blocks b where b.blocker_id = uid and b.blocked_id = target) then
    return;
  end if;
  select count(*) into n from blocks where blocker_id = uid;
  if n >= 200 then
    raise exception 'Tu as déjà bloqué 200 personnes';
  end if;
  insert into blocks (blocker_id, blocked_id) values (uid, target) on conflict do nothing;
  delete from follows
  where (follower_id = uid and followee_id = target) or (follower_id = target and followee_id = uid);
end;
$$;

create or replace function public.unblock(p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(trim(coalesce(p_handle, '')));
begin
  delete from blocks b
  using profiles p
  where p.handle = h and b.blocker_id = uid and b.blocked_id = p.id;
end;
$$;

-- Les personnes que j'ai bloquées (jamais celles qui m'ont bloqué).
create or replace function public.list_blocked()
returns table (handle text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  return query
  select p.handle
  from blocks b
  join profiles p on p.id = b.blocked_id
  where b.blocker_id = uid
  order by b.created_at desc
  limit 200;
end;
$$;

-- Afficher un passage : la référence seulement. 30 au plus.
create or replace function public.show_passage(p_book integer, p_chapter integer, p_from integer, p_to integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  n integer;
begin
  if not exists (select 1 from profiles where id = uid) then
    raise exception 'profil';
  end if;
  if p_book is null or p_chapter is null or p_from is null or p_to is null
    or p_book not between 1 and 73
    or p_chapter not between 1 and 999
    or p_from not between 1 and 999
    or p_to not between p_from and 999 then
    raise exception 'passage';
  end if;
  if exists (
    select 1 from profile_passages
    where user_id = uid and book = p_book and chapter = p_chapter and verse_from = p_from and verse_to = p_to
  ) then
    return;
  end if;
  select count(*) into n from profile_passages where user_id = uid;
  if n >= 30 then
    raise exception 'Tu affiches déjà 30 passages';
  end if;
  insert into profile_passages (user_id, book, chapter, verse_from, verse_to)
  values (uid, p_book, p_chapter, p_from, p_to)
  on conflict do nothing;
end;
$$;

create or replace function public.hide_passage(p_book integer, p_chapter integer, p_from integer, p_to integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  delete from profile_passages
  where user_id = uid and book = p_book and chapter = p_chapter and verse_from = p_from and verse_to = p_to;
end;
$$;

-- Afficher une prière, ou mettre à jour sa copie : titre et texte copiés. 20 au plus.
create or replace function public.show_prayer(p_prayer_id text, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  pid text := trim(coalesce(p_prayer_id, ''));
  t text := trim(coalesce(p_title, ''));
  b text := trim(coalesce(p_body, ''));
  n integer;
begin
  if not exists (select 1 from profiles where id = uid) then
    raise exception 'profil';
  end if;
  if char_length(pid) < 1 or char_length(pid) > 64
    or char_length(t) < 1 or char_length(t) > 80
    or char_length(b) < 1 or char_length(b) > 4000 then
    raise exception 'longueur';
  end if;
  if exists (select 1 from profile_prayers where user_id = uid and prayer_id = pid) then
    update profile_prayers set title = t, body = b, updated_at = now()
    where user_id = uid and prayer_id = pid;
    return;
  end if;
  select count(*) into n from profile_prayers where user_id = uid;
  if n >= 20 then
    raise exception 'Tu affiches déjà 20 prières';
  end if;
  insert into profile_prayers (user_id, prayer_id, title, body) values (uid, pid, t, b);
end;
$$;

create or replace function public.hide_prayer(p_prayer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  delete from profile_prayers where user_id = uid and prayer_id = trim(coalesce(p_prayer_id, ''));
end;
$$;

-- Afficher (ou retirer) sur mon profil une de MES intentions non retirées. L'intention reste anonyme dans le fil global.
create or replace function public.set_intention_on_profile(p_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  if p_on is distinct from true then
    update intentions set shown_on_profile = false where id = p_id and user_id = uid;
    return;
  end if;
  if not exists (select 1 from profiles where id = uid) then
    raise exception 'profil';
  end if;
  update intentions set shown_on_profile = true
  where id = p_id and user_id = uid and withdrawn_at is null;
  if not found then
    raise exception 'introuvable';
  end if;
end;
$$;

-- La vitrine de p_owner telle que la voit p_viewer. Interne : pas de droit d'exécution pour les clients.
-- Vide si can_see_profile refuse (propriétaire ou personnes qu'il suit seulement, jamais en cas de blocage).
create or replace function public.showcase_of(p_owner uuid, p_viewer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner is null or not public.can_see_profile(p_viewer, p_owner) then
    return jsonb_build_object('passages', '[]'::jsonb, 'prayers', '[]'::jsonb, 'intentions', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'passages', coalesce((
      select jsonb_agg(
        jsonb_build_object('book', x.book, 'chapter', x.chapter, 'verse_from', x.verse_from, 'verse_to', x.verse_to)
        order by x.created_at desc
      )
      from profile_passages x where x.user_id = p_owner
    ), '[]'::jsonb),
    'prayers', coalesce((
      select jsonb_agg(
        jsonb_build_object('prayer_id', x.prayer_id, 'title', x.title, 'body', x.body)
        order by x.published_at desc
      )
      from profile_prayers x where x.user_id = p_owner
    ), '[]'::jsonb),
    'intentions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'body', x.body,
          'created_at', x.created_at,
          'mine', x.user_id = p_viewer,
          'carries', coalesce(c.count, 0),
          'carrying', exists (select 1 from carries k where k.intention_id = x.id and k.user_id = p_viewer)
        )
        order by x.created_at desc
      )
      from (
        select i.* from intentions i
        where i.user_id = p_owner and i.shown_on_profile and i.withdrawn_at is null
        order by i.created_at desc
        limit 50
      ) x
      left join carry_counts c on c.intention_id = x.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Ce que J'affiche.
create or replace function public.get_my_showcase()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  return public.showcase_of(uid, uid);
end;
$$;

-- La vitrine d'un pseudo exact : vide si le pseudo est inconnu, bloqué (dans un sens ou l'autre) ou si son
-- propriétaire ne suit pas l'appelant.
create or replace function public.get_showcase(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(trim(coalesce(p_handle, '')));
  owner uuid;
begin
  select p.id into owner from profiles p where p.handle = h;
  return public.showcase_of(owner, uid);
end;
$$;

revoke all on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_see_profile(uuid, uuid) from public, anon, authenticated;
revoke all on function public.showcase_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public.find_profile(text) from public, anon, authenticated;
revoke all on function public.get_profile(text) from public, anon, authenticated;
revoke all on function public.follow(text) from public, anon, authenticated;
revoke all on function public.block(text) from public, anon, authenticated;
revoke all on function public.unblock(text) from public, anon, authenticated;
revoke all on function public.list_blocked() from public, anon, authenticated;
revoke all on function public.show_passage(integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.hide_passage(integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.show_prayer(text, text, text) from public, anon, authenticated;
revoke all on function public.hide_prayer(text) from public, anon, authenticated;
revoke all on function public.set_intention_on_profile(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_my_showcase() from public, anon, authenticated;
revoke all on function public.get_showcase(text) from public, anon, authenticated;

grant execute on function public.find_profile(text) to authenticated;
grant execute on function public.get_profile(text) to authenticated;
grant execute on function public.follow(text) to authenticated;
grant execute on function public.block(text) to authenticated;
grant execute on function public.unblock(text) to authenticated;
grant execute on function public.list_blocked() to authenticated;
grant execute on function public.show_passage(integer, integer, integer, integer) to authenticated;
grant execute on function public.hide_passage(integer, integer, integer, integer) to authenticated;
grant execute on function public.show_prayer(text, text, text) to authenticated;
grant execute on function public.hide_prayer(text) to authenticated;
grant execute on function public.set_intention_on_profile(uuid, boolean) to authenticated;
grant execute on function public.get_my_showcase() to authenticated;
grant execute on function public.get_showcase(text) to authenticated;
