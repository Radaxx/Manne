-- Rendez-vous de prière de groupe.
--
-- Un rendez-vous appartient à un groupe : titre (3 à 60), description facultative (280 au plus), durée de 10 à 180 minutes,
-- et soit HEBDOMADAIRE (un jour de la semaine, une heure locale et le fuseau IANA de son créateur, par exemple
-- Europe/Paris), soit PONCTUEL (un instant timestamptz, futur, dans l'année).
--
-- Jour de la semaine (weekday) : 0 à 6 avec DIMANCHE = 0, comme extract(dow from …) de Postgres, getDay() de JavaScript
-- et WEEKDAYS de src/dates.ts. Lundi = 1, samedi = 6.
--
-- Qui fait quoi :
--   propriétaire ou modérateur : créer, modifier, annuler (10 rendez-vous actifs au plus par groupe, pas de création ni de
--     modification dans un groupe terminé) ;
--   tout membre : voir les rendez-vous, s'inscrire (« Je participe ») et se désinscrire, se déclarer présent.
-- Seuls les membres voient les rendez-vous. Aucun pseudo n'est exposé : on ne donne que des nombres (inscrits, présents).
-- Les rappels sont LOCAUX (sur le téléphone des inscrits) : le serveur ne pousse rien.
--
-- Occurrences : calculées ici, avec `at time zone`, donc correctes aux changements d'heure d'été et d'hiver ; l'horloge
-- du client n'est jamais crue. L'occurrence « en cours » va de 10 minutes avant le début jusqu'à la fin de la durée ;
-- « Je suis là » (mark_present) la calcule lui-même et refuse en dehors.
--
-- Les tables ne sont pas lisibles directement (RLS sans politique, droits retirés) : tout passe par les fonctions ci-dessous.
--
-- delete_my_account (004) : supprimer auth.users emporte gathering_participants et gathering_presence de la personne par
--   on delete cascade ; group_gatherings.created_by passe à null (le rendez-vous reste au groupe). Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme n'est membre de rien et ne s'inscrit à rien.
-- Départ d'un membre (quitter, exclusion) : le trigger group_members_gatherings_cleanup (ci-dessous) retire ses
--   inscriptions ; group_members_after_delete (008) n'est pas modifié. Ses présences passées restent mais ne sont plus
--   comptées (on ne compte que les membres actuels).

create table public.group_gatherings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  description text not null default '',
  duration_min integer not null default 30,
  recurrence text not null,
  weekday smallint,
  local_time time,
  timezone text,
  starts_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint group_gatherings_title_len check (char_length(btrim(title)) between 3 and 60),
  constraint group_gatherings_description_len check (char_length(description) <= 280),
  constraint group_gatherings_duration check (duration_min between 10 and 180),
  constraint group_gatherings_recurrence check (recurrence in ('weekly', 'once')),
  constraint group_gatherings_shape check (
    (recurrence = 'weekly' and weekday between 0 and 6 and local_time is not null and timezone is not null and starts_at is null)
    or (recurrence = 'once' and starts_at is not null and weekday is null and local_time is null and timezone is null)
  )
);

create index group_gatherings_group_idx on public.group_gatherings (group_id) where cancelled_at is null;

create table public.gathering_participants (
  gathering_id uuid not null references public.group_gatherings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gathering_id, user_id)
);

create index gathering_participants_user_idx on public.gathering_participants (user_id);

create table public.gathering_presence (
  gathering_id uuid not null references public.group_gatherings (id) on delete cascade,
  occurrence_start timestamptz not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gathering_id, occurrence_start, user_id)
);

create index gathering_presence_user_idx on public.gathering_presence (user_id);

alter table public.group_gatherings enable row level security;
alter table public.gathering_participants enable row level security;
alter table public.gathering_presence enable row level security;

revoke all on table public.group_gatherings from anon, authenticated;
revoke all on table public.gathering_participants from anon, authenticated;
revoke all on table public.gathering_presence from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Aides internes : pas de droit d'exécution pour les clients.
-- ---------------------------------------------------------------------------------------------------------------

-- Début de l'occurrence la plus récente qui a commencé (<= p_now), ou null (ponctuel pas encore commencé).
create or replace function public.gathering_last_start(g public.group_gatherings, p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  local_now timestamp;
  d date;
  s timestamptz;
begin
  if g.recurrence = 'once' then
    return case when g.starts_at <= p_now then g.starts_at else null end;
  end if;
  local_now := p_now at time zone g.timezone;
  d := local_now::date - ((extract(dow from local_now)::integer - g.weekday + 7) % 7);
  s := (d + g.local_time) at time zone g.timezone;
  if s > p_now then
    s := ((d - 7) + g.local_time) at time zone g.timezone;
  end if;
  return s;
end;
$$;

-- Début de la première occurrence qui commence APRÈS p_now, ou null (ponctuel déjà commencé).
create or replace function public.gathering_next_occurrence(g public.group_gatherings, p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  last_start timestamptz;
begin
  if g.recurrence = 'once' then
    return case when g.starts_at > p_now then g.starts_at else null end;
  end if;
  last_start := public.gathering_last_start(g, p_now);
  return (((last_start at time zone g.timezone)::date + 7) + g.local_time) at time zone g.timezone;
end;
$$;

-- Début de l'occurrence EN COURS à p_now (de 10 minutes avant le début jusqu'à la fin de la durée), ou null.
create or replace function public.gathering_current_occurrence(g public.group_gatherings, p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  last_start timestamptz := public.gathering_last_start(g, p_now);
  next_start timestamptz := public.gathering_next_occurrence(g, p_now);
  span interval := make_interval(mins => g.duration_min);
begin
  if last_start is not null and p_now < last_start + span then
    return last_start;
  end if;
  if next_start is not null and p_now >= next_start - interval '10 minutes' then
    return next_start;
  end if;
  return null;
end;
$$;

-- Vérifie et normalise les champs d'un rendez-vous (création et modification).
-- Codes : titre_invalide, longueur, duree_invalide, recurrence_invalide, jour_invalide, heure_invalide,
-- fuseau_invalide, date_invalide.
create or replace function public.check_gathering_fields(
  p_title text,
  p_description text,
  p_duration integer,
  p_recurrence text,
  p_weekday integer,
  p_local_time time,
  p_timezone text,
  p_starts_at timestamptz
)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if char_length(btrim(coalesce(p_title, ''))) < 3 or char_length(btrim(p_title)) > 60 then
    raise exception 'titre_invalide';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) > 280 then
    raise exception 'longueur';
  end if;
  if p_duration is null or p_duration < 10 or p_duration > 180 then
    raise exception 'duree_invalide';
  end if;
  if p_recurrence is null or p_recurrence not in ('weekly', 'once') then
    raise exception 'recurrence_invalide';
  end if;
  if p_recurrence = 'weekly' then
    if p_weekday is null or p_weekday < 0 or p_weekday > 6 then
      raise exception 'jour_invalide';
    end if;
    if p_local_time is null then
      raise exception 'heure_invalide';
    end if;
    if p_timezone is null or not exists (select 1 from pg_timezone_names n where n.name = p_timezone) then
      raise exception 'fuseau_invalide';
    end if;
  else
    if p_starts_at is null or p_starts_at <= now() or p_starts_at > now() + interval '1 year' then
      raise exception 'date_invalide';
    end if;
  end if;
end;
$$;

-- Départ d'un membre : ses inscriptions aux rendez-vous de ce groupe disparaissent (les rappels locaux s'arrêtent
-- à la prochaine synchronisation). Trigger dédié : group_members_after_delete (008) reste tel quel.
create or replace function public.group_members_gatherings_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from gathering_participants p
  using group_gatherings g
  where p.gathering_id = g.id and g.group_id = old.group_id and p.user_id = old.user_id;
  return old;
end;
$$;

create trigger group_members_gatherings_cleanup
  after delete on public.group_members
  for each row execute function public.group_members_gatherings_cleanup();

-- ---------------------------------------------------------------------------------------------------------------
-- Rendez-vous : créer, modifier, annuler
-- ---------------------------------------------------------------------------------------------------------------

-- Propriétaire ou modérateur. Codes : groupe_inconnu (pas membre), interdit, plus ceux de check_gathering_fields.
-- Messages français : « Ce groupe est terminé », « Ce groupe a déjà 10 rendez-vous ».
create or replace function public.create_gathering(
  p_group uuid,
  p_title text,
  p_description text,
  p_duration integer,
  p_recurrence text,
  p_weekday integer,
  p_local_time time,
  p_timezone text,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_group, uid);
  ends timestamptz;
  new_id uuid;
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  -- Verrou sur le groupe : la limite de 10 tient sous concurrence.
  select g.ends_at into ends from groups g where g.id = p_group for update;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  perform public.check_gathering_fields(p_title, p_description, p_duration, p_recurrence, p_weekday, p_local_time, p_timezone, p_starts_at);
  if (
    select count(*) from group_gatherings x
    where x.group_id = p_group and x.cancelled_at is null
      and (x.recurrence = 'weekly' or x.starts_at + make_interval(mins => x.duration_min) > now())
  ) >= 10 then
    raise exception 'Ce groupe a déjà 10 rendez-vous';
  end if;
  insert into group_gatherings (group_id, title, description, duration_min, recurrence, weekday, local_time, timezone, starts_at, created_by)
  values (
    p_group,
    btrim(p_title),
    btrim(coalesce(p_description, '')),
    p_duration,
    p_recurrence,
    case when p_recurrence = 'weekly' then p_weekday end,
    case when p_recurrence = 'weekly' then make_time(extract(hour from p_local_time)::integer, extract(minute from p_local_time)::integer, 0) end,
    case when p_recurrence = 'weekly' then p_timezone end,
    case when p_recurrence = 'once' then p_starts_at end,
    uid
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Propriétaire ou modérateur du groupe du rendez-vous. Les inscriptions restent. Code : rdv_inconnu.
create or replace function public.update_gathering(
  p_id uuid,
  p_title text,
  p_description text,
  p_duration integer,
  p_recurrence text,
  p_weekday integer,
  p_local_time time,
  p_timezone text,
  p_starts_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  gid uuid;
  r text;
  ends timestamptz;
begin
  select x.group_id into gid from group_gatherings x where x.id = p_id and x.cancelled_at is null;
  r := case when gid is null then null else public.group_role(gid, uid) end;
  if r is null then
    raise exception 'rdv_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  select g.ends_at into ends from groups g where g.id = gid;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  perform public.check_gathering_fields(p_title, p_description, p_duration, p_recurrence, p_weekday, p_local_time, p_timezone, p_starts_at);
  update group_gatherings set
    title = btrim(p_title),
    description = btrim(coalesce(p_description, '')),
    duration_min = p_duration,
    recurrence = p_recurrence,
    weekday = case when p_recurrence = 'weekly' then p_weekday end,
    local_time = case when p_recurrence = 'weekly' then make_time(extract(hour from p_local_time)::integer, extract(minute from p_local_time)::integer, 0) end,
    timezone = case when p_recurrence = 'weekly' then p_timezone end,
    starts_at = case when p_recurrence = 'once' then p_starts_at end
  where id = p_id;
end;
$$;

-- Propriétaire ou modérateur. Possible aussi dans un groupe terminé. Les inscriptions et présences partent avec la
-- ligne si on la supprime un jour ; ici on garde la ligne, annulée.
create or replace function public.cancel_gathering(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  gid uuid;
  r text;
begin
  select x.group_id into gid from group_gatherings x where x.id = p_id and x.cancelled_at is null;
  r := case when gid is null then null else public.group_role(gid, uid) end;
  if r is null then
    raise exception 'rdv_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  update group_gatherings set cancelled_at = now() where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Lecture
-- ---------------------------------------------------------------------------------------------------------------

-- Les rendez-vous à venir (ou en cours) du groupe, pour un membre. Un ponctuel passé n'y figure plus.
-- next_start : début de la prochaine occurrence (null pour un ponctuel déjà commencé).
-- current_start : début de l'occurrence en cours (fenêtre de présence), sinon null.
-- present_count / present : présences de CETTE occurrence en cours (0 / false sinon), membres actuels seulement.
create or replace function public.list_gatherings(p_group uuid)
returns table (
  id uuid,
  title text,
  description text,
  duration_min integer,
  recurrence text,
  weekday integer,
  local_time text,
  timezone text,
  starts_at timestamptz,
  next_start timestamptz,
  current_start timestamptz,
  participant_count integer,
  participating boolean,
  present_count integer,
  present boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
begin
  if public.group_role(p_group, uid) is null then
    raise exception 'groupe_inconnu';
  end if;
  return query
  select
    g.id,
    g.title,
    g.description,
    g.duration_min,
    g.recurrence,
    g.weekday::integer,
    to_char(g.local_time, 'HH24:MI'),
    g.timezone,
    g.starts_at,
    n.nxt,
    c.cur,
    (select count(*)::integer from gathering_participants p where p.gathering_id = g.id),
    exists (select 1 from gathering_participants p where p.gathering_id = g.id and p.user_id = uid),
    case when c.cur is null then 0 else (
      select count(*)::integer from gathering_presence s
      join group_members m on m.group_id = g.group_id and m.user_id = s.user_id
      where s.gathering_id = g.id and s.occurrence_start = c.cur
    ) end,
    case when c.cur is null then false else exists (
      select 1 from gathering_presence s
      where s.gathering_id = g.id and s.occurrence_start = c.cur and s.user_id = uid
    ) end
  from group_gatherings g
  cross join lateral (select public.gathering_current_occurrence(g, now()) as cur) c
  cross join lateral (select public.gathering_next_occurrence(g, now()) as nxt) n
  where g.group_id = p_group and g.cancelled_at is null and (c.cur is not null or n.nxt is not null)
  order by coalesce(c.cur, n.nxt), g.created_at;
end;
$$;

-- Mes rendez-vous auxquels je suis inscrit, dans les groupes où je suis encore membre et qui ne sont pas terminés,
-- non annulés, à venir : de quoi programmer les rappels sur le téléphone.
create or replace function public.my_gatherings()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  title text,
  recurrence text,
  weekday integer,
  local_time text,
  timezone text,
  starts_at timestamptz,
  duration_min integer
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
    g.group_id,
    gr.name,
    g.title,
    g.recurrence,
    g.weekday::integer,
    to_char(g.local_time, 'HH24:MI'),
    g.timezone,
    g.starts_at,
    g.duration_min
  from gathering_participants p
  join group_gatherings g on g.id = p.gathering_id
  join groups gr on gr.id = g.group_id
  join group_members m on m.group_id = g.group_id and m.user_id = uid
  cross join lateral (select public.gathering_next_occurrence(g, now()) as nxt) n
  where p.user_id = uid
    and g.cancelled_at is null
    and not public.group_ended(gr.ends_at)
    and n.nxt is not null
  order by n.nxt;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Participation et présence (tout membre)
-- ---------------------------------------------------------------------------------------------------------------

-- « Je participe » / « Je ne participe plus ». S'inscrire demande un rendez-vous à venir dans un groupe non terminé.
create or replace function public.set_participation(p_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  g public.group_gatherings;
  ends timestamptz;
begin
  select * into g from group_gatherings x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(g.group_id, uid) is null then
    raise exception 'rdv_inconnu';
  end if;
  if p_on is true then
    select gr.ends_at into ends from groups gr where gr.id = g.group_id;
    if public.group_ended(ends) then
      raise exception 'Ce groupe est terminé';
    end if;
    if public.gathering_current_occurrence(g, now()) is null and public.gathering_next_occurrence(g, now()) is null then
      raise exception 'Ce rendez-vous est passé';
    end if;
    insert into gathering_participants (gathering_id, user_id) values (p_id, uid) on conflict do nothing;
  else
    delete from gathering_participants p where p.gathering_id = p_id and p.user_id = uid;
  end if;
end;
$$;

-- « Je suis là » : le serveur calcule l'occurrence en cours et refuse en dehors de la fenêtre.
create or replace function public.mark_present(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  g public.group_gatherings;
  ends timestamptz;
  cur timestamptz;
begin
  select * into g from group_gatherings x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(g.group_id, uid) is null then
    raise exception 'rdv_inconnu';
  end if;
  select gr.ends_at into ends from groups gr where gr.id = g.group_id;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  cur := public.gathering_current_occurrence(g, now());
  if cur is null then
    raise exception 'Ce rendez-vous n’est pas en cours';
  end if;
  insert into gathering_presence (gathering_id, occurrence_start, user_id) values (p_id, cur, uid) on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Droits : aides internes fermées, fonctions de l'app ouvertes aux comptes connectés seulement.
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function public.gathering_last_start(public.group_gatherings, timestamptz) from public, anon, authenticated;
revoke all on function public.gathering_next_occurrence(public.group_gatherings, timestamptz) from public, anon, authenticated;
revoke all on function public.gathering_current_occurrence(public.group_gatherings, timestamptz) from public, anon, authenticated;
revoke all on function public.check_gathering_fields(text, text, integer, text, integer, time, text, timestamptz) from public, anon, authenticated;
revoke all on function public.group_members_gatherings_cleanup() from public, anon, authenticated;

revoke all on function public.create_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz) from public, anon, authenticated;
revoke all on function public.update_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz) from public, anon, authenticated;
revoke all on function public.cancel_gathering(uuid) from public, anon, authenticated;
revoke all on function public.list_gatherings(uuid) from public, anon, authenticated;
revoke all on function public.my_gatherings() from public, anon, authenticated;
revoke all on function public.set_participation(uuid, boolean) from public, anon, authenticated;
revoke all on function public.mark_present(uuid) from public, anon, authenticated;

grant execute on function public.create_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz) to authenticated;
grant execute on function public.update_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz) to authenticated;
grant execute on function public.cancel_gathering(uuid) to authenticated;
grant execute on function public.list_gatherings(uuid) to authenticated;
grant execute on function public.my_gatherings() to authenticated;
grant execute on function public.set_participation(uuid, boolean) to authenticated;
grant execute on function public.mark_present(uuid) to authenticated;
