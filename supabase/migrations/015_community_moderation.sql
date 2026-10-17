-- Modération communautaire (étape 1) : motifs de signalement, signalement d'un profil et de sa vitrine, file de
-- signalements d'un groupe, bannissement de groupe et filtre à la publication.
--
-- Motifs : reports et group_reports portent un motif (insulte, inapproprie, spam, autre). Les fonctions de signalement
--   prennent un motif FACULTATIF (p_reason, défaut null = 'autre') : un téléphone qui ne connaît pas encore les motifs
--   continue de signaler. Un motif inconnu compte comme 'autre'.
--
-- Profil et vitrine : profile_reports (profil entier, ou une prière de la vitrine). À 3 signalements distincts et non
--   traités, la bio et la paroisse du profil sont masquées pour les autres (profiles.flagged_at ; le pseudo reste), ou la
--   prière de vitrine est masquée pour les autres (profile_prayers.hidden_at). Le propriétaire voit toujours son contenu,
--   avec un drapeau « masqué », et le modifier lève le masquage (nouveau contenu : les signalements en cours sont clos).
--
-- Groupes : group_reports.resolved_at marque un signalement traité. Le masquage à 3 ne compte que les signalements non
--   traités (rétablir une intention puis la voir signalée trois fois de plus la masque de nouveau). Le propriétaire ou un
--   modérateur lit la file (list_group_reports) et la vide : restore_group_intention, remove_group_intention,
--   dismiss_group_reports. my_groups et get_group donnent le nombre d'intentions à traiter (pending_reports).
--
-- Bannissement : group_bans. ban_member exclut ET empêche de revenir (code, recherche, demande). add_group_member (appelée
--   par join_by_code, join_group et answer_request) et request_join refusent un banni.
--
-- Filtre : banned_terms (illisible par les clients) + contains_banned_term(text), appelée par des triggers
--   « before insert or update » sur tous les textes publiés. Mots entiers seulement, sans accents ni majuscules, avec les
--   chiffres de substitution les plus simples (0->o 1->i 3->e 4->a @->a $->s). Message d'erreur : contenu_refuse.
--
-- Pour l'étape 2 (un modérateur éditeur avec un écran global) : reports, group_reports et profile_reports portent déjà un
--   motif ; group_reports et profile_reports portent resolved_at. reports (échos et intentions du fil) n'en a pas encore :
--   l'étape 2 l'ajoutera avec sa propre migration.
--
-- delete_my_account (004) : supprimer auth.users emporte profile_reports (dans les deux colonnes) et group_bans (par
--   on delete cascade ; banned_by passe à null). Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme ne signale que des échos et des intentions du fil.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Motifs de signalement
-- ---------------------------------------------------------------------------------------------------------------

alter table public.reports
  add column reason text not null default 'autre',
  add constraint reports_reason check (reason in ('insulte', 'inapproprie', 'spam', 'autre'));

alter table public.group_reports
  add column reason text not null default 'autre',
  add column resolved_at timestamptz,
  add constraint group_reports_reason check (reason in ('insulte', 'inapproprie', 'spam', 'autre'));

create index group_reports_pending_idx on public.group_reports (intention_id) where resolved_at is null;

-- Le motif reçu, ramené à l'un des quatre connus. Interne.
create or replace function public.report_reason(p_reason text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(btrim(coalesce(p_reason, ''))) in ('insulte', 'inapproprie', 'spam') then lower(btrim(p_reason))
    else 'autre'
  end;
$$;

revoke all on function public.report_reason(text) from public, anon, authenticated;

-- Le paramètre s'ajoute : on remplace les fonctions (drop puis create) et on rétablit les mêmes droits.
drop function public.report_echo(uuid);
drop function public.report_intention(uuid);
drop function public.report_group_intention(uuid);

create function public.report_echo(p_id uuid, p_reason text default null)
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
  insert into reports (user_id, echo_id, reason) values (uid, p_id, public.report_reason(p_reason));
exception
  when unique_violation then
    raise exception 'Déjà signalé';
end;
$$;

create function public.report_intention(p_id uuid, p_reason text default null)
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
  insert into reports (user_id, intention_id, reason) values (uid, p_id, public.report_reason(p_reason));
exception
  when unique_violation then
    raise exception 'Déjà signalé';
end;
$$;

create function public.report_group_intention(p_intention_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  author uuid;
begin
  select v.author into author from public.visible_group_intention(p_intention_id, uid) v;
  if author = uid then
    raise exception 'ta_intention';
  end if;
  insert into group_reports (user_id, intention_id, reason) values (uid, p_intention_id, public.report_reason(p_reason));
exception
  when unique_violation then
    raise exception 'Déjà signalé';
end;
$$;

revoke all on function public.report_echo(uuid, text) from public, anon, authenticated;
revoke all on function public.report_intention(uuid, text) from public, anon, authenticated;
revoke all on function public.report_group_intention(uuid, text) from public, anon, authenticated;

grant execute on function public.report_echo(uuid, text) to authenticated;
grant execute on function public.report_intention(uuid, text) to authenticated;
grant execute on function public.report_group_intention(uuid, text) to authenticated;

-- Trois signalements NON TRAITÉS masquent l'intention de groupe (remplace la version de 008 ; le trigger reste en place).
create or replace function public.hide_group_intention_on_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*) into n
  from group_reports r
  where r.intention_id = new.intention_id and r.resolved_at is null;
  if n >= 3 then
    update group_intentions set hidden = true where id = new.intention_id;
  end if;
  return new;
end;
$$;

revoke all on function public.hide_group_intention_on_reports() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Signaler un profil et sa vitrine
-- ---------------------------------------------------------------------------------------------------------------

alter table public.profiles add column flagged_at timestamptz;
alter table public.profile_prayers add column hidden_at timestamptz;

create table public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references auth.users (id) on delete cascade,
  subject text not null,
  prayer_id text,
  reason text not null default 'autre',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint profile_reports_subject check (subject in ('profil', 'priere')),
  constraint profile_reports_shape check (
    (subject = 'profil' and prayer_id is null) or (subject = 'priere' and prayer_id is not null)
  ),
  constraint profile_reports_reason check (reason in ('insulte', 'inapproprie', 'spam', 'autre')),
  constraint profile_reports_not_self check (reporter_id <> target_id)
);

-- Un seul signalement en cours par personne et par élément. Une fois traité, la personne peut signaler de nouveau.
create unique index profile_reports_once
  on public.profile_reports (reporter_id, target_id, subject, coalesce(prayer_id, ''))
  where resolved_at is null;
create index profile_reports_pending_idx
  on public.profile_reports (target_id, subject, coalesce(prayer_id, ''))
  where resolved_at is null;

alter table public.profile_reports enable row level security;
revoke all on table public.profile_reports from anon, authenticated;

-- Trois signalements distincts et non traités masquent le profil (bio et paroisse) ou la prière de vitrine.
create or replace function public.hide_profile_on_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*) into n
  from profile_reports r
  where r.target_id = new.target_id
    and r.subject = new.subject
    and coalesce(r.prayer_id, '') = coalesce(new.prayer_id, '')
    and r.resolved_at is null;
  if n < 3 then
    return new;
  end if;
  if new.subject = 'profil' then
    update profiles set flagged_at = now() where id = new.target_id and flagged_at is null;
  else
    update profile_prayers set hidden_at = now()
    where user_id = new.target_id and prayer_id = new.prayer_id and hidden_at is null;
  end if;
  return new;
end;
$$;

create trigger profile_reports_hide
  after insert on public.profile_reports
  for each row execute function public.hide_profile_on_reports();

-- Nouveau contenu = nouveau départ : modifier la bio ou la paroisse lève le masquage et clôt les signalements en cours.
create or replace function public.profiles_content_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bio is distinct from old.bio or new.parish is distinct from old.parish then
    new.flagged_at := null;
    update profile_reports set resolved_at = now()
    where target_id = new.id and subject = 'profil' and resolved_at is null;
  end if;
  return new;
end;
$$;

create trigger profiles_content_changed
  before update on public.profiles
  for each row execute function public.profiles_content_changed();

-- Idem pour une prière de vitrine dont le titre ou le texte change.
create or replace function public.profile_prayers_content_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body then
    new.hidden_at := null;
    update profile_reports set resolved_at = now()
    where target_id = new.user_id and subject = 'priere' and prayer_id = new.prayer_id and resolved_at is null;
  end if;
  return new;
end;
$$;

create trigger profile_prayers_content_changed
  before update on public.profile_prayers
  for each row execute function public.profile_prayers_content_changed();

-- Une prière retirée de la vitrine emporte ses signalements en cours (si elle est ré-affichée, c'est un nouveau contenu).
create or replace function public.profile_prayers_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profile_reports set resolved_at = now()
  where target_id = old.user_id and subject = 'priere' and prayer_id = old.prayer_id and resolved_at is null;
  return old;
end;
$$;

create trigger profile_prayers_after_delete
  after delete on public.profile_prayers
  for each row execute function public.profile_prayers_after_delete();

revoke all on function public.hide_profile_on_reports() from public, anon, authenticated;
revoke all on function public.profiles_content_changed() from public, anon, authenticated;
revoke all on function public.profile_prayers_content_changed() from public, anon, authenticated;
revoke all on function public.profile_prayers_after_delete() from public, anon, authenticated;

-- Signaler le profil d'un pseudo exact (le pseudo suffit : il est visible de qui le connaît). Pas soi-même, pas une
-- personne qui a bloqué l'appelant ou que l'appelant a bloquée.
create or replace function public.report_profile(p_handle text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(btrim(coalesce(p_handle, '')));
  target uuid;
begin
  select p.id into target from profiles p where p.handle = h;
  if target is null or public.is_blocked(uid, target) then
    raise exception 'introuvable';
  end if;
  if target = uid then
    raise exception 'propre';
  end if;
  insert into profile_reports (reporter_id, target_id, subject, reason)
  values (uid, target, 'profil', public.report_reason(p_reason));
exception
  when unique_violation then
    raise exception 'Déjà signalé';
end;
$$;

-- Signaler une prière de la vitrine : seulement si la vitrine est visible de l'appelant (can_see_profile) et la prière
-- non masquée.
create or replace function public.report_profile_prayer(p_handle text, p_prayer_id text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  h text := lower(btrim(coalesce(p_handle, '')));
  pid text := btrim(coalesce(p_prayer_id, ''));
  target uuid;
begin
  select p.id into target from profiles p where p.handle = h;
  if target is null then
    raise exception 'introuvable';
  end if;
  if target = uid then
    raise exception 'propre';
  end if;
  if not public.can_see_profile(uid, target)
    or not exists (
      select 1 from profile_prayers x where x.user_id = target and x.prayer_id = pid and x.hidden_at is null
    ) then
    raise exception 'priere_inconnue';
  end if;
  insert into profile_reports (reporter_id, target_id, subject, prayer_id, reason)
  values (uid, target, 'priere', pid, public.report_reason(p_reason));
exception
  when unique_violation then
    raise exception 'Déjà signalé';
end;
$$;

revoke all on function public.report_profile(text, text) from public, anon, authenticated;
revoke all on function public.report_profile_prayer(text, text, text) from public, anon, authenticated;
grant execute on function public.report_profile(text, text) to authenticated;
grant execute on function public.report_profile_prayer(text, text, text) to authenticated;

-- Même signature qu'en 007 : bio et paroisse sont masquées pour les autres tant que le profil est signalé.
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
    case when v.ok and (p.flagged_at is null or p.id = uid) then p.bio end,
    case when v.ok and (p.flagged_at is null or p.id = uid) then p.parish end,
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

-- Mon profil, avec `flagged` : sa bio et sa paroisse sont masquées pour les autres après plusieurs signalements.
drop function public.get_my_profile();

create function public.get_my_profile()
returns table (
  handle text,
  display_name text,
  bio text,
  parish text,
  followers integer,
  following_count integer,
  flagged boolean
)
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
    (select count(*)::integer from follows f where f.follower_id = p.id),
    p.flagged_at is not null
  from profiles p
  where p.id = uid;
end;
$$;

revoke all on function public.get_profile(text) from public, anon, authenticated;
revoke all on function public.get_my_profile() from public, anon, authenticated;
grant execute on function public.get_profile(text) to authenticated;
grant execute on function public.get_my_profile() to authenticated;

-- Même signature qu'en 007. Les prières masquées ne sortent que pour leur propriétaire, avec `hidden: true`.
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
        jsonb_build_object('prayer_id', x.prayer_id, 'title', x.title, 'body', x.body, 'hidden', x.hidden_at is not null)
        order by x.published_at desc
      )
      from profile_prayers x
      where x.user_id = p_owner and (x.hidden_at is null or p_owner = p_viewer)
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

revoke all on function public.showcase_of(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. File de signalements d'un groupe
-- ---------------------------------------------------------------------------------------------------------------

-- Propriétaire ou modérateur du groupe de cette intention (non retirée) ; renvoie l'identifiant du groupe. Interne.
create or replace function public.moderated_group_of(p_intention_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  gid uuid;
  r text;
begin
  select i.group_id into gid from group_intentions i where i.id = p_intention_id and i.withdrawn_at is null;
  if gid is null then
    raise exception 'intention_inconnue';
  end if;
  r := public.group_role(gid, uid);
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  return gid;
end;
$$;

revoke all on function public.moderated_group_of(uuid) from public, anon, authenticated;

-- Propriétaire ou modérateur : les intentions du groupe signalées et pas encore traitées (100 au plus), les masquées
-- d'abord. Une ligne par intention : l'auteur, le nombre de signalements et leur répartition par motif.
create or replace function public.list_group_reports(p_group_id uuid)
returns table (
  id uuid,
  body text,
  handle text,
  author_role text,
  hidden boolean,
  created_at timestamptz,
  last_reported_at timestamptz,
  reports integer,
  insulte integer,
  inapproprie integer,
  spam integer,
  autre integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_group_id, uid);
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  return query
  select
    i.id,
    i.body,
    coalesce(p.handle, ''),
    m.role,
    i.hidden,
    i.created_at,
    max(g.created_at),
    count(*)::integer,
    (count(*) filter (where g.reason = 'insulte'))::integer,
    (count(*) filter (where g.reason = 'inapproprie'))::integer,
    (count(*) filter (where g.reason = 'spam'))::integer,
    (count(*) filter (where g.reason = 'autre'))::integer
  from group_reports g
  join group_intentions i on i.id = g.intention_id
  left join profiles p on p.id = i.user_id
  left join group_members m on m.group_id = i.group_id and m.user_id = i.user_id
  where i.group_id = p_group_id and i.withdrawn_at is null and g.resolved_at is null
  group by i.id, i.body, p.handle, m.role, i.hidden, i.created_at
  order by i.hidden desc, max(g.created_at) desc, i.id
  limit 100;
end;
$$;

-- Clôt les signalements en cours d'une intention. Interne.
create or replace function public.resolve_group_reports(p_intention_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update group_reports set resolved_at = now() where intention_id = p_intention_id and resolved_at is null;
$$;

revoke all on function public.resolve_group_reports(uuid) from public, anon, authenticated;

-- Propriétaire ou modérateur : rend l'intention visible (si elle était masquée) et clôt ses signalements.
create or replace function public.restore_group_intention(p_intention_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.moderated_group_of(p_intention_id);
  update group_intentions set hidden = false where id = p_intention_id;
  perform public.resolve_group_reports(p_intention_id);
end;
$$;

-- Propriétaire ou modérateur : garde l'intention visible et clôt ses signalements. Comme restore_group_intention, elle
-- rend visible une intention masquée : « laisser visible » ne laisse jamais une intention cachée sans signalement à traiter.
create or replace function public.dismiss_group_reports(p_intention_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.moderated_group_of(p_intention_id);
  update group_intentions set hidden = false where id = p_intention_id;
  perform public.resolve_group_reports(p_intention_id);
end;
$$;

-- Remplace la version de 008 : même règle, et les signalements de l'intention retirée sont clos.
create or replace function public.remove_group_intention(p_intention_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.moderated_group_of(p_intention_id);
  update group_intentions set withdrawn_at = now() where id = p_intention_id;
  perform public.resolve_group_reports(p_intention_id);
end;
$$;

revoke all on function public.list_group_reports(uuid) from public, anon, authenticated;
revoke all on function public.restore_group_intention(uuid) from public, anon, authenticated;
revoke all on function public.dismiss_group_reports(uuid) from public, anon, authenticated;
revoke all on function public.remove_group_intention(uuid) from public, anon, authenticated;
grant execute on function public.list_group_reports(uuid) to authenticated;
grant execute on function public.restore_group_intention(uuid) to authenticated;
grant execute on function public.dismiss_group_reports(uuid) to authenticated;
grant execute on function public.remove_group_intention(uuid) to authenticated;

-- my_groups et get_group : `pending_reports`, le nombre d'intentions à traiter (propriétaire et modérateur seulement).
drop function public.my_groups();
drop function public.get_group(uuid);

create function public.my_groups()
returns table (
  id uuid,
  name text,
  description text,
  kind text,
  ends_at timestamptz,
  ended boolean,
  role text,
  member_count integer,
  pending_requests integer,
  pending_reports integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
begin
  return query
  select
    g.id,
    g.name,
    g.description,
    g.kind,
    g.ends_at,
    public.group_ended(g.ends_at),
    m.role,
    (select count(*)::integer from group_members x where x.group_id = g.id),
    case when m.role in ('owner', 'moderator')
      then (select count(*)::integer from group_requests r where r.group_id = g.id)
      else 0
    end,
    case when m.role in ('owner', 'moderator')
      then (
        select count(distinct s.intention_id)::integer
        from group_reports s
        join group_intentions i on i.id = s.intention_id
        where i.group_id = g.id and i.withdrawn_at is null and s.resolved_at is null
      )
      else 0
    end
  from group_members m
  join groups g on g.id = m.group_id
  where m.user_id = uid
  order by public.group_ended(g.ends_at), lower(g.name), g.id;
end;
$$;

create function public.get_group(p_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  kind text,
  ends_at timestamptz,
  ended boolean,
  member_count integer,
  my_status text,
  my_role text,
  invite_code text,
  pending_requests integer,
  pending_reports integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
begin
  return query
  select
    g.id,
    g.name,
    g.description,
    g.kind,
    g.ends_at,
    public.group_ended(g.ends_at),
    (select count(*)::integer from group_members x where x.group_id = g.id),
    case
      when r is not null then 'member'
      when exists (select 1 from group_requests q where q.group_id = g.id and q.user_id = uid) then 'requested'
      else 'none'
    end,
    r,
    case when r is not null then g.invite_code end,
    case when r in ('owner', 'moderator')
      then (select count(*)::integer from group_requests q where q.group_id = g.id)
      else 0
    end,
    case when r in ('owner', 'moderator')
      then (
        select count(distinct s.intention_id)::integer
        from group_reports s
        join group_intentions i on i.id = s.intention_id
        where i.group_id = g.id and i.withdrawn_at is null and s.resolved_at is null
      )
      else 0
    end
  from groups g
  where g.id = p_id and (r is not null or g.kind <> 'fraternite');
end;
$$;

revoke all on function public.my_groups() from public, anon, authenticated;
revoke all on function public.get_group(uuid) from public, anon, authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.get_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Bannissement de groupe
-- ---------------------------------------------------------------------------------------------------------------

create table public.group_bans (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  banned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_bans_user_idx on public.group_bans (user_id);

alter table public.group_bans enable row level security;
revoke all on table public.group_bans from anon, authenticated;

-- Remplace la version de 008 : refuse un banni. Utilisée par join_by_code, join_group et answer_request.
create or replace function public.add_group_member(p_group uuid, p_user uuid, p_self boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ends timestamptz;
begin
  select g.ends_at into ends from groups g where g.id = p_group for update;
  if not found then
    raise exception 'groupe_inconnu';
  end if;
  if exists (select 1 from group_bans b where b.group_id = p_group and b.user_id = p_user) then
    if p_self then
      raise exception 'Tu ne peux pas rejoindre ce groupe.';
    end if;
    raise exception 'Cette personne ne peut pas rejoindre ce groupe.';
  end if;
  if exists (select 1 from group_members m where m.group_id = p_group and m.user_id = p_user) then
    delete from group_requests r where r.group_id = p_group and r.user_id = p_user;
    return;
  end if;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  if (select count(*) from group_members m where m.group_id = p_group) >= 200 then
    raise exception 'Ce groupe est complet';
  end if;
  if (select count(*) from group_members m where m.user_id = p_user) >= 20 then
    if p_self then
      raise exception 'Tu es déjà dans 20 groupes';
    end if;
    raise exception 'Cette personne est déjà dans 20 groupes';
  end if;
  insert into group_members (group_id, user_id, role) values (p_group, p_user, 'member');
  delete from group_requests r where r.group_id = p_group and r.user_id = p_user;
end;
$$;

revoke all on function public.add_group_member(uuid, uuid, boolean) from public, anon, authenticated;

-- Remplace la version de 008 : refuse un banni avant toute demande.
create or replace function public.request_join(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  k text;
begin
  select g.kind into k from groups g where g.id = p_id;
  if k is null or k = 'fraternite' then
    raise exception 'groupe_inconnu';
  end if;
  if k <> 'communaute' then
    raise exception 'pas_de_demande';
  end if;
  if exists (select 1 from group_bans b where b.group_id = p_id and b.user_id = uid) then
    raise exception 'Tu ne peux pas rejoindre ce groupe.';
  end if;
  if exists (select 1 from group_members m where m.group_id = p_id and m.user_id = uid) then
    return;
  end if;
  if exists (select 1 from group_requests r where r.group_id = p_id and r.user_id = uid) then
    return;
  end if;
  if (select count(*) from group_members m where m.group_id = p_id) >= 200 then
    raise exception 'Ce groupe est complet';
  end if;
  if (select count(*) from group_members m where m.user_id = uid) >= 20 then
    raise exception 'Tu es déjà dans 20 groupes';
  end if;
  if (select count(*) from group_requests r where r.user_id = uid) >= 20 then
    raise exception 'Tu as déjà 20 demandes en attente';
  end if;
  insert into group_requests (group_id, user_id) values (p_id, uid);
end;
$$;

revoke all on function public.request_join(uuid) from public, anon, authenticated;
grant execute on function public.request_join(uuid) to authenticated;

-- Propriétaire ou modérateur : exclut ET empêche de revenir. Mêmes règles que remove_member : jamais le propriétaire, jamais
-- soi-même, et un modérateur ne bannit pas un modérateur. 200 personnes bannies au plus par groupe.
create or replace function public.ban_member(p_id uuid, p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
  h text := lower(btrim(coalesce(p_handle, '')));
  target uuid;
  target_role text;
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  select p.id into target from profiles p where p.handle = h;
  target_role := public.group_role(p_id, target);
  if target is null or target_role is null then
    raise exception 'cible';
  end if;
  if target = uid or target_role = 'owner' then
    raise exception 'proprio';
  end if;
  if r = 'moderator' and target_role = 'moderator' then
    raise exception 'interdit';
  end if;
  if (select count(*) from group_bans b where b.group_id = p_id) >= 200 then
    raise exception 'Ce groupe a déjà banni 200 personnes';
  end if;
  insert into group_bans (group_id, user_id, banned_by) values (p_id, target, uid)
  on conflict (group_id, user_id) do update set banned_by = excluded.banned_by;
  delete from group_requests q where q.group_id = p_id and q.user_id = target;
  delete from group_members where group_id = p_id and user_id = target;
end;
$$;

-- Propriétaire ou modérateur : lève le bannissement (la personne peut de nouveau rejoindre le groupe).
create or replace function public.unban_member(p_id uuid, p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
  h text := lower(btrim(coalesce(p_handle, '')));
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  delete from group_bans b
  using profiles p
  where p.handle = h and b.group_id = p_id and b.user_id = p.id;
end;
$$;

-- Propriétaire ou modérateur : les personnes bannies, les plus récentes d'abord.
create or replace function public.list_bans(p_id uuid)
returns table (handle text, banned_by text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  return query
  select p.handle, w.handle, b.created_at
  from group_bans b
  join profiles p on p.id = b.user_id
  left join profiles w on w.id = b.banned_by
  where b.group_id = p_id
  order by b.created_at desc, p.handle
  limit 200;
end;
$$;

revoke all on function public.ban_member(uuid, text) from public, anon, authenticated;
revoke all on function public.unban_member(uuid, text) from public, anon, authenticated;
revoke all on function public.list_bans(uuid) from public, anon, authenticated;
grant execute on function public.ban_member(uuid, text) to authenticated;
grant execute on function public.unban_member(uuid, text) to authenticated;
grant execute on function public.list_bans(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Filtre à la publication
-- ---------------------------------------------------------------------------------------------------------------

-- Termes refusés : en minuscules, sans accents, des mots entiers ou des expressions de mots entiers. Aucun terme du
-- vocabulaire chrétien (enfer, démon, péché, mort, sang…). Illisible par les clients (RLS sans politique, droits retirés).
create table public.banned_terms (
  term text primary key,
  constraint banned_terms_fmt check (term ~ '^[a-z]+( [a-z]+)*$')
);

alter table public.banned_terms enable row level security;
revoke all on table public.banned_terms from anon, authenticated;

insert into public.banned_terms (term) values
  -- insultes et grossièretés courantes
  ('connard'), ('connards'), ('connasse'), ('connasses'),
  ('salope'), ('salopes'), ('salopard'), ('saloperie'),
  ('pute'), ('putes'), ('putain'), ('petasse'),
  ('enfoire'), ('enfoires'), ('encule'), ('encules'), ('enculer'), ('enculeur'),
  ('merde'), ('merdeux'), ('bordel'), ('couilles'), ('branleur'),
  ('fdp'), ('ntm'), ('nique ta mere'), ('fils de pute'), ('ta gueule'), ('va te faire foutre'), ('trou du cul'),
  -- injures homophobes
  ('pede'), ('pedes'), ('tarlouze'), ('tarlouse'), ('gouine'), ('gouines'), ('fiotte'), ('tafiole'),
  -- injures racistes
  ('negre'), ('negres'), ('negresse'), ('bougnoule'), ('bougnoules'), ('bicot'), ('bicots'),
  ('youpin'), ('youpins'), ('crouille'), ('chinetoque'), ('niakoue'), ('bamboula'),
  ('sale juif'), ('sale arabe'), ('sale noir'),
  -- anglais courant
  ('fuck'), ('fucker'), ('fucking'), ('motherfucker'), ('shit'), ('bitch'), ('asshole'), ('cunt'),
  ('nigger'), ('nigga'), ('faggot');

-- Le texte tel que le compare le filtre : sans caractères invisibles, sans accents, en minuscules, avec les chiffres de
-- substitution simples, tout ce qui n'est pas une lettre devenant une espace. Interne.
create or replace function public.normalize_for_filter(p_text text)
returns text
language sql
stable
set search_path = public
as $$
  select btrim(regexp_replace(
    translate(
      lower(extensions.unaccent(regexp_replace(coalesce(p_text, ''), E'[\\u200b-\\u200d\\u2060\\ufeff\\u00ad]', '', 'g'))),
      '0134@$',
      'oieaas'
    ),
    '[^a-z]+',
    ' ',
    'g'
  ));
$$;

-- Le texte contient-il un terme refusé, en mot entier ? Interne.
create or replace function public.contains_banned_term(p_text text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n text := public.normalize_for_filter(p_text);
begin
  if n = '' then
    return false;
  end if;
  n := ' ' || n || ' ';
  return exists (select 1 from banned_terms t where position(' ' || t.term || ' ' in n) > 0);
end;
$$;

-- Trigger « before insert or update » : les colonnes à contrôler sont les arguments. À la mise à jour, seule une
-- valeur modifiée est contrôlée (un texte ancien n'empêche pas les autres modifications).
create or replace function public.reject_banned_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  col text;
  v text;
begin
  foreach col in array tg_argv loop
    v := to_jsonb(new) ->> col;
    if v is null then
      continue;
    end if;
    if tg_op = 'UPDATE' and v is not distinct from (to_jsonb(old) ->> col) then
      continue;
    end if;
    if public.contains_banned_term(v) then
      raise exception 'contenu_refuse';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.normalize_for_filter(text) from public, anon, authenticated;
revoke all on function public.contains_banned_term(text) from public, anon, authenticated;
revoke all on function public.reject_banned_terms() from public, anon, authenticated;

create trigger echoes_banned_terms
  before insert or update on public.echoes
  for each row execute function public.reject_banned_terms('body');
create trigger intentions_banned_terms
  before insert or update on public.intentions
  for each row execute function public.reject_banned_terms('body');
create trigger profiles_banned_terms
  before insert or update on public.profiles
  for each row execute function public.reject_banned_terms('handle', 'bio', 'parish');
create trigger profile_prayers_banned_terms
  before insert or update on public.profile_prayers
  for each row execute function public.reject_banned_terms('title', 'body');
create trigger groups_banned_terms
  before insert or update on public.groups
  for each row execute function public.reject_banned_terms('name', 'description');
create trigger group_intentions_banned_terms
  before insert or update on public.group_intentions
  for each row execute function public.reject_banned_terms('body', 'thanks');
create trigger group_gatherings_banned_terms
  before insert or update on public.group_gatherings
  for each row execute function public.reject_banned_terms('title', 'description');
create trigger group_novenas_banned_terms
  before insert or update on public.group_novenas
  for each row execute function public.reject_banned_terms('title', 'intention', 'custom_prayer');
create trigger adoration_chains_banned_terms
  before insert or update on public.adoration_chains
  for each row execute function public.reject_banned_terms('title', 'intention', 'place');
