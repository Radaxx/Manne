-- Récurrences : rendez-vous sur plusieurs jours de la semaine, avec une fin ; chaînes d'adoration hebdomadaires.
--
-- Cette migration ne modifie ni 009, ni 010, ni 013 (déjà appliquées) : elle convertit leurs données et remplace leurs
-- fonctions. Un changement de signature ou de type de retour exige `drop function` puis `create function` : les droits de
-- 009, 010 et 013 sont rétablis à la fin (aides internes fermées, fonctions de l'app ouvertes aux comptes connectés seulement).
--
-- ═══ RENDEZ-VOUS DE PRIÈRE (group_gatherings) ═══════════════════════════════════════════════════════════════════
--
-- Avant : un hebdomadaire a UN jour (weekday smallint, 0 = dimanche) et dure sans fin.
-- Après : `weekdays smallint[]` (1 à 7 valeurs distinctes de 0 à 6, triées, 0 = dimanche comme extract(dow …)) et
-- `ends_on date` facultative (null = sans fin). Conversion : weekdays = array[weekday]. La colonne `weekday` est SUPPRIMÉE
-- (une seule source de vérité : deux colonnes pourraient se contredire, et plus aucune fonction ne la lit). Compatibilité des
-- téléphones d'avant : create_gathering et update_gathering gardent `p_weekday` (un seul jour) et ajoutent `p_weekdays` et
-- `p_ends_on` avec une valeur par défaut ; les lectures renvoient toujours `weekday` (le premier jour de `weekdays`) en plus de
-- `weekdays` et `ends_on`. Un téléphone d'avant voit donc un seul jour d'un rendez-vous multi-jours, et s'il modifie ce
-- rendez-vous, il le ramène à ce jour (sans fin) : la modification se fait avec la nouvelle version.
-- Occurrences : une occurrence hebdomadaire existe si son JOUR LOCAL (dans le fuseau du rendez-vous) est <= ends_on. Après
-- ends_on il n'y a plus de « prochaine » ni d'occurrence « en cours » : plus de rappel, plus de salle (can_use_room et
-- room_state ne changent pas, ils appellent gathering_current_occurrence), plus d'« à venir » (list_gatherings et
-- my_gatherings les omettent). Ses inscriptions et présences restent.
-- Calcul : weekly_last_start et weekly_next_start (heure locale du fuseau puis conversion `at time zone`, donc correct aux
-- changements d'heure ; l'horloge du client n'est jamais crue).
--
-- ═══ CHAÎNES D'ADORATION (adoration_chains, adoration_slots) ═══════════════════════════════════════════════════
--
-- Deux formes. `once` (comme en 013) : début et fin (instants), de 1 h à 7 jours, fin sur un créneau entier. `weekly` :
-- `weekdays` (1 à 7 jours, 0 = dimanche), `local_start` et `local_end` (heures locales du fuseau ; la fin peut tomber le
-- lendemain, 21:00 -> 07:00 ; des heures égales font 24 h), `first_on` et `last_on` (premier et dernier JOUR locaux ; au plus
-- un an entre les deux), `timezone`. Une occurrence dure de 30 min à 24 h, en créneaux entiers (30 ou 60 min). 400 occurrences
-- au plus par chaîne (la limite d'un an en laisse 367 au plus : le plafond est une garde). Une occurrence commence à
-- `(jour + local_start) at time zone fuseau` et FINIT à l'heure du mur `local_end` : les nuits de changement d'heure comptent
-- donc un créneau de plus ou de moins (21 h -> 7 h fait 11 h le 25 octobre 2026 à Paris), jamais un créneau coupé.
-- `starts_at` et `ends_at` restent les bornes de la chaîne (début de la première occurrence, fin de la dernière) : les listes
-- de groupe, le plafond de 3 chaînes actives et « terminée » s'appuient dessus comme en 013.
--
-- Créneaux : identifiés par leur INSTANT de début (`slot_start timestamptz`) au lieu d'un index. Conversion de 013 :
-- slot_start = starts_at + slot_index x slot_minutes ; nouvelle clé primaire (chain_id, slot_start, user_id) ; slot_index et
-- sa contrainte sont supprimés. Un slot_start n'est valide que s'il tombe EXACTEMENT sur un créneau d'une occurrence de la
-- chaîne (adoration_slot_occurrence), sinon `creneau_invalide`. Toutes les RPC prennent et renvoient slot_start.
--
-- Détail : get_adoration_chain(id, p_from date, p_weeks) ne renvoie qu'une FENÊTRE d'occurrences (celles qui finissent après
-- minuit du jour p_from, dans le fuseau de la chaîne, et commencent avant p_from + p_weeks semaines ; par défaut aujourd'hui, 4
-- semaines, 12 au plus). Une chaîne `once` renvoie toujours son unique occurrence. Chaque occurrence porte ses créneaux
-- ({ start, count, mine, handles, hidden }) : couverture et trous se calculent par occurrence. `has_more` dit s'il en reste
-- après la fenêtre. Les listes de groupe ne renvoient que l'occurrence en cours ou la prochaine (la dernière si la chaîne est
-- finie), sans les pseudos.
-- Réservations : 10 adorateurs au plus par créneau ; 12 créneaux NON TERMINÉS au plus par personne et par chaîne, toutes
-- occurrences confondues. Aucune réservation automatique sur plusieurs semaines.
--
-- Modifier (update_adoration_chain) : CHOIX. Le titre, l'intention et le lieu changent toujours. Tant que la chaîne n'a pas
-- commencé ET qu'aucun créneau n'est réservé, tout le reste change (comme à la création). Dès qu'elle a commencé ou qu'un
-- créneau est réservé, le rythme (jours, heures, créneaux, début, fuseau) ne change plus : seule la FIN peut être repoussée
-- (once : ends_at plus tard ; weekly : last_on plus tard). Aucune réservation n'est donc jamais déplacée ni libérée en
-- silence ; le refus est un message clair. La forme (once ou weekly) ne change jamais.
--
-- delete_my_account (004), adopt_account (002/003) : rien à changer (les mêmes cascades ; adoration_slots garde user_id et
-- chain_id). Les triggers de départ d'un membre (009, 013) ne sont pas modifiés.

-- ---------------------------------------------------------------------------------------------------------------
-- Aides partagées
-- ---------------------------------------------------------------------------------------------------------------

-- Jours de la semaine valides : 1 à 7 valeurs distinctes de 0 à 6, sans null.
create function public.weekdays_valid(w smallint[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select w is not null
    and cardinality(w) between 1 and 7
    and array_position(w, null) is null
    and w <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    and cardinality(w) = (select count(distinct x) from unnest(w) as x);
$$;

-- Normalise des jours reçus d'un client : p_weekdays, sinon l'ancien p_weekday seul. Renvoie le tableau trié, ou null s'il est
-- invalide (vide, plus de 7 valeurs, hors de 0 à 6, doublon).
create function public.normalize_weekdays(p_weekdays integer[], p_weekday integer default null)
returns smallint[]
language plpgsql
immutable
set search_path = public
as $$
declare
  src integer[] := coalesce(p_weekdays, case when p_weekday is null then null else array[p_weekday] end);
begin
  if src is null or cardinality(src) < 1 or cardinality(src) > 7 then
    return null;
  end if;
  if array_position(src, null) is not null or exists (select 1 from unnest(src) as x where x < 0 or x > 6) then
    return null;
  end if;
  if (select count(distinct x) from unnest(src) as x) <> cardinality(src) then
    return null;
  end if;
  return array(select x::smallint from unnest(src) as x order by x);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Rendez-vous : colonnes et conversion des données
-- ---------------------------------------------------------------------------------------------------------------

alter table public.group_gatherings
  add column weekdays smallint[],
  add column ends_on date;

update public.group_gatherings set weekdays = array[weekday]::smallint[] where recurrence = 'weekly';

alter table public.group_gatherings drop constraint group_gatherings_shape;
alter table public.group_gatherings drop column weekday;
alter table public.group_gatherings
  add constraint group_gatherings_shape check (
    (recurrence = 'weekly' and public.weekdays_valid(weekdays) and local_time is not null and timezone is not null and starts_at is null)
    or (recurrence = 'once' and starts_at is not null and weekdays is null and ends_on is null and local_time is null and timezone is null)
  );

-- ---------------------------------------------------------------------------------------------------------------
-- Rendez-vous : calcul des occurrences (aides internes)
-- ---------------------------------------------------------------------------------------------------------------

-- Début de l'occurrence hebdomadaire la plus récente qui a commencé (<= p_now), ou null. Un jour local après p_ends_on n'a
-- pas d'occurrence.
create function public.weekly_last_start(p_weekdays smallint[], p_local_time time, p_tz text, p_ends_on date, p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  d date := (p_now at time zone p_tz)::date;
  x date;
  s timestamptz;
  k integer;
begin
  if p_ends_on is not null and p_ends_on < d then
    d := p_ends_on;
  end if;
  for k in 0..7 loop
    x := d - k;
    if extract(dow from x)::smallint = any (p_weekdays) then
      s := (x + p_local_time) at time zone p_tz;
      if s <= p_now then
        return s;
      end if;
    end if;
  end loop;
  return null;
end;
$$;

-- Début de la première occurrence hebdomadaire qui commence APRÈS p_now, ou null (aucune avant la fin).
create function public.weekly_next_start(p_weekdays smallint[], p_local_time time, p_tz text, p_ends_on date, p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  d date := (p_now at time zone p_tz)::date;
  x date;
  s timestamptz;
  k integer;
begin
  for k in 0..8 loop
    x := d + k;
    if p_ends_on is not null and x > p_ends_on then
      return null;
    end if;
    if extract(dow from x)::smallint = any (p_weekdays) then
      s := (x + p_local_time) at time zone p_tz;
      if s > p_now then
        return s;
      end if;
    end if;
  end loop;
  return null;
end;
$$;

-- Même signature et même type de retour qu'en 009 : `create or replace` garde les droits (fermés).
create or replace function public.gathering_last_start(g public.group_gatherings, p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
begin
  if g.recurrence = 'once' then
    return case when g.starts_at <= p_now then g.starts_at else null end;
  end if;
  return public.weekly_last_start(g.weekdays, g.local_time, g.timezone, g.ends_on, p_now);
end;
$$;

create or replace function public.gathering_next_occurrence(g public.group_gatherings, p_now timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
begin
  if g.recurrence = 'once' then
    return case when g.starts_at > p_now then g.starts_at else null end;
  end if;
  return public.weekly_next_start(g.weekdays, g.local_time, g.timezone, g.ends_on, p_now);
end;
$$;

-- gathering_current_occurrence (010) n'est pas touchée : elle appelle les deux fonctions ci-dessus, donc room_state,
-- can_use_room, post_room_intention, mark_present et set_participation suivent sans changement.

-- ---------------------------------------------------------------------------------------------------------------
-- Rendez-vous : validation, création, modification
-- ---------------------------------------------------------------------------------------------------------------

drop function public.check_gathering_fields(text, text, integer, text, integer, time, text, timestamptz);

-- Vérifie les champs d'un rendez-vous (création et modification). p_weekdays est déjà normalisé (null = invalide).
-- Codes : titre_invalide, longueur, duree_invalide, recurrence_invalide, jour_invalide, heure_invalide, fuseau_invalide,
-- date_invalide, fin_rdv (la fin n'est pas entre aujourd'hui et dans un an, ou aucune occurrence n'a lieu avant elle).
create function public.check_gathering_fields(
  p_title text,
  p_description text,
  p_duration integer,
  p_recurrence text,
  p_weekdays smallint[],
  p_local_time time,
  p_timezone text,
  p_starts_at timestamptz,
  p_ends_on date
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  today date;
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
    if not public.weekdays_valid(p_weekdays) then
      raise exception 'jour_invalide';
    end if;
    if p_local_time is null then
      raise exception 'heure_invalide';
    end if;
    if p_timezone is null or not exists (select 1 from pg_timezone_names n where n.name = p_timezone) then
      raise exception 'fuseau_invalide';
    end if;
    if p_ends_on is not null then
      today := (now() at time zone p_timezone)::date;
      if p_ends_on < today or p_ends_on > (today + interval '1 year')::date then
        raise exception 'fin_rdv';
      end if;
      if public.weekly_next_start(p_weekdays, p_local_time, p_timezone, p_ends_on, now()) is null then
        raise exception 'fin_rdv';
      end if;
    end if;
  else
    if p_starts_at is null or p_starts_at <= now() or p_starts_at > now() + interval '1 year' then
      raise exception 'date_invalide';
    end if;
  end if;
end;
$$;

drop function public.create_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text);
drop function public.update_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text);

-- Comme en 010, plus p_weekdays (plusieurs jours ; p_weekday reste pour les téléphones d'avant) et p_ends_on (dernier jour
-- local, facultatif). Propriétaire ou modérateur. Codes : groupe_inconnu, interdit, priere_invalide, plus ceux de
-- check_gathering_fields. Messages : « Ce groupe est terminé », « Ce groupe a déjà 10 rendez-vous ».
create function public.create_gathering(
  p_group uuid,
  p_title text,
  p_description text,
  p_duration integer,
  p_recurrence text,
  p_weekday integer,
  p_local_time time,
  p_timezone text,
  p_starts_at timestamptz,
  p_prayer_kind text default 'libre',
  p_weekdays integer[] default null,
  p_ends_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_group, uid);
  kind text := coalesce(p_prayer_kind, 'libre');
  weekly boolean := p_recurrence = 'weekly';
  days smallint[] := case when p_recurrence = 'weekly' then public.normalize_weekdays(p_weekdays, p_weekday) end;
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
  if kind not in ('libre', 'chapelet', 'office', 'adoration') then
    raise exception 'priere_invalide';
  end if;
  perform public.check_gathering_fields(p_title, p_description, p_duration, p_recurrence, days, p_local_time, p_timezone, p_starts_at, p_ends_on);
  if (
    select count(*) from group_gatherings x
    where x.group_id = p_group and x.cancelled_at is null
      and (public.gathering_next_occurrence(x, now()) is not null or public.gathering_current_occurrence(x, now()) is not null)
  ) >= 10 then
    raise exception 'Ce groupe a déjà 10 rendez-vous';
  end if;
  insert into group_gatherings (group_id, title, description, duration_min, recurrence, weekdays, local_time, timezone, starts_at, ends_on, prayer_kind, created_by)
  values (
    p_group,
    btrim(p_title),
    btrim(coalesce(p_description, '')),
    p_duration,
    p_recurrence,
    case when weekly then days end,
    case when weekly then make_time(extract(hour from p_local_time)::integer, extract(minute from p_local_time)::integer, 0) end,
    case when weekly then p_timezone end,
    case when not weekly then p_starts_at end,
    case when weekly then p_ends_on end,
    kind,
    uid
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- p_prayer_kind nul : la prière du rendez-vous ne change pas. Propriétaire ou modérateur du groupe du rendez-vous. Les
-- inscriptions restent. Code : rdv_inconnu.
create function public.update_gathering(
  p_id uuid,
  p_title text,
  p_description text,
  p_duration integer,
  p_recurrence text,
  p_weekday integer,
  p_local_time time,
  p_timezone text,
  p_starts_at timestamptz,
  p_prayer_kind text default null,
  p_weekdays integer[] default null,
  p_ends_on date default null
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
  weekly boolean := p_recurrence = 'weekly';
  days smallint[] := case when p_recurrence = 'weekly' then public.normalize_weekdays(p_weekdays, p_weekday) end;
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
  if p_prayer_kind is not null and p_prayer_kind not in ('libre', 'chapelet', 'office', 'adoration') then
    raise exception 'priere_invalide';
  end if;
  perform public.check_gathering_fields(p_title, p_description, p_duration, p_recurrence, days, p_local_time, p_timezone, p_starts_at, p_ends_on);
  update group_gatherings set
    title = btrim(p_title),
    description = btrim(coalesce(p_description, '')),
    duration_min = p_duration,
    recurrence = p_recurrence,
    weekdays = case when weekly then days end,
    local_time = case when weekly then make_time(extract(hour from p_local_time)::integer, extract(minute from p_local_time)::integer, 0) end,
    timezone = case when weekly then p_timezone end,
    starts_at = case when not weekly then p_starts_at end,
    ends_on = case when weekly then p_ends_on end,
    prayer_kind = coalesce(p_prayer_kind, prayer_kind)
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Rendez-vous : lectures
-- ---------------------------------------------------------------------------------------------------------------

drop function public.list_gatherings(uuid);

-- Comme en 010, plus weekdays et ends_on en dernières colonnes. `weekday` reste (le premier jour de weekdays) pour les
-- téléphones d'avant. Un rendez-vous dont la fin est passée n'y figure plus.
create function public.list_gatherings(p_group uuid)
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
  present boolean,
  prayer_kind text,
  weekdays integer[],
  ends_on date
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
    g.weekdays[1]::integer,
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
    ) end,
    g.prayer_kind,
    g.weekdays::integer[],
    g.ends_on
  from group_gatherings g
  cross join lateral (select public.gathering_current_occurrence(g, now()) as cur) c
  cross join lateral (select public.gathering_next_occurrence(g, now()) as nxt) n
  where g.group_id = p_group and g.cancelled_at is null and (c.cur is not null or n.nxt is not null)
  order by coalesce(c.cur, n.nxt), g.created_at;
end;
$$;

drop function public.my_gatherings();

-- Comme en 010, plus weekdays et ends_on en dernières colonnes (et `weekday` conservé, voir list_gatherings).
create function public.my_gatherings()
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
  duration_min integer,
  prayer_kind text,
  present boolean,
  weekdays integer[],
  ends_on date
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
    g.weekdays[1]::integer,
    to_char(g.local_time, 'HH24:MI'),
    g.timezone,
    g.starts_at,
    g.duration_min,
    g.prayer_kind,
    case when c.cur is null then false else exists (
      select 1 from gathering_presence s
      where s.gathering_id = g.id and s.occurrence_start = c.cur and s.user_id = uid
    ) end,
    g.weekdays::integer[],
    g.ends_on
  from gathering_participants p
  join group_gatherings g on g.id = p.gathering_id
  join groups gr on gr.id = g.group_id
  join group_members m on m.group_id = g.group_id and m.user_id = uid
  cross join lateral (select public.gathering_next_occurrence(g, now()) as nxt) n
  cross join lateral (select public.gathering_current_occurrence(g, now()) as cur) c
  where p.user_id = uid
    and g.cancelled_at is null
    and not public.group_ended(gr.ends_at)
    and (n.nxt is not null or c.cur is not null)
  order by coalesce(c.cur, n.nxt);
end;
$$;

-- mark_present, set_participation, room_state, can_use_room, post_room_intention : inchangées (elles passent par
-- gathering_current_occurrence et gathering_next_occurrence).

-- ---------------------------------------------------------------------------------------------------------------
-- Chaînes d'adoration : colonnes et conversion des données
-- ---------------------------------------------------------------------------------------------------------------

alter table public.adoration_chains
  add column recurrence text not null default 'once',
  add column weekdays smallint[],
  add column local_start time,
  add column local_end time,
  add column first_on date,
  add column last_on date;

alter table public.adoration_chains drop constraint adoration_chains_span;
alter table public.adoration_chains
  add constraint adoration_chains_recurrence check (recurrence in ('once', 'weekly')),
  add constraint adoration_chains_shape check (
    (
      recurrence = 'once'
      and weekdays is null and local_start is null and local_end is null and first_on is null and last_on is null
      and ends_at - starts_at between interval '1 hour' and interval '7 days'
      and mod((extract(epoch from (ends_at - starts_at)) / 60)::bigint, slot_minutes) = 0
    )
    or (
      recurrence = 'weekly'
      and public.weekdays_valid(weekdays)
      and local_start is not null and local_end is not null
      and first_on is not null and last_on is not null
      and last_on >= first_on and last_on - first_on <= 366
      and ends_at > starts_at
    )
  );

-- Créneaux : slot_index -> slot_start.
alter table public.adoration_slots add column slot_start timestamptz;

update public.adoration_slots s
set slot_start = c.starts_at + make_interval(mins => s.slot_index::integer * c.slot_minutes::integer)
from public.adoration_chains c
where c.id = s.chain_id;

alter table public.adoration_slots alter column slot_start set not null;
alter table public.adoration_slots drop constraint adoration_slots_pkey;
alter table public.adoration_slots drop constraint adoration_slots_index;
alter table public.adoration_slots drop column slot_index;
alter table public.adoration_slots add primary key (chain_id, slot_start, user_id);

create index adoration_slots_user_start_idx on public.adoration_slots (user_id, slot_start);

-- ---------------------------------------------------------------------------------------------------------------
-- Chaînes d'adoration : anciennes fonctions à index (remplacées plus bas)
-- ---------------------------------------------------------------------------------------------------------------

drop function public.adoration_slot_count(public.adoration_chains);
drop function public.adoration_slot_start(public.adoration_chains, integer);
drop function public.adoration_slot_end(public.adoration_chains, integer);
drop function public.check_adoration_fields(text, text, text, timestamptz, timestamptz, integer, text);
drop function public.adoration_chain_json(public.adoration_chains, uuid);
drop function public.create_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text);
drop function public.update_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text);
drop function public.get_adoration_chain(uuid);
drop function public.reserve_slot(uuid, integer);
drop function public.release_slot(uuid, integer);
drop function public.remove_slot_reservation(uuid, integer, text);

-- ---------------------------------------------------------------------------------------------------------------
-- Chaînes d'adoration : occurrences et créneaux (aides internes)
-- ---------------------------------------------------------------------------------------------------------------

-- Les occurrences hebdomadaires entre deux jours locaux (inclus), en heure locale du fuseau puis conversion. La fin est à
-- l'heure du mur local_end, le lendemain si elle n'est pas après le début (21:00 -> 07:00 ; des heures égales font 24 h).
create function public.adoration_weekly_occurrences(
  p_weekdays smallint[],
  p_local_start time,
  p_local_end time,
  p_tz text,
  p_first_on date,
  p_last_on date
)
returns table (occ_start timestamptz, occ_end timestamptz)
language sql
stable
set search_path = public
as $$
  select
    (g.d + p_local_start) at time zone p_tz,
    ((g.d + case when p_local_end > p_local_start then 0 else 1 end) + p_local_end) at time zone p_tz
  from (select x::date as d from generate_series(p_first_on::timestamp, p_last_on::timestamp, interval '1 day') as x) g
  where extract(dow from g.d)::smallint = any (p_weekdays);
$$;

-- Toutes les occurrences d'une chaîne (une seule pour `once`), sans ordre garanti.
create function public.adoration_occurrences(c public.adoration_chains)
returns table (occ_start timestamptz, occ_end timestamptz)
language sql
stable
set search_path = public
as $$
  select c.starts_at, c.ends_at where c.recurrence = 'once'
  union all
  select o.occ_start, o.occ_end
  from public.adoration_weekly_occurrences(c.weekdays, c.local_start, c.local_end, c.timezone, c.first_on, c.last_on) o
  where c.recurrence = 'weekly';
$$;

-- Nombre de créneaux entiers d'une occurrence.
create function public.adoration_occurrence_slots(p_slot_minutes integer, p_start timestamptz, p_end timestamptz)
returns integer
language sql
immutable
set search_path = public
as $$
  select floor(extract(epoch from (p_end - p_start)) / 60 / p_slot_minutes)::integer;
$$;

-- Début de l'occurrence dont p_slot_start est EXACTEMENT un créneau, ou null s'il n'en est pas un (hors occurrence, créneau
-- coupé par la fin de l'occurrence, instant qui ne tombe pas sur le découpage). Pour une hebdomadaire, on cherche
-- l'occurrence du jour local du créneau et celle de la veille (une occurrence de nuit commence la veille).
create function public.adoration_slot_occurrence(c public.adoration_chains, p_slot_start timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  d date;
  k integer;
  o record;
  span interval := make_interval(mins => c.slot_minutes);
begin
  if p_slot_start is null then
    return null;
  end if;
  if c.recurrence = 'once' then
    if p_slot_start >= c.starts_at
      and p_slot_start + span <= c.ends_at
      and mod(extract(epoch from (p_slot_start - c.starts_at)), c.slot_minutes * 60) = 0 then
      return c.starts_at;
    end if;
    return null;
  end if;
  d := (p_slot_start at time zone c.timezone)::date;
  for k in 0..1 loop
    select * into o
    from public.adoration_weekly_occurrences(c.weekdays, c.local_start, c.local_end, c.timezone, greatest(d - k, c.first_on), least(d - k, c.last_on));
    if found
      and p_slot_start >= o.occ_start
      and p_slot_start + span <= o.occ_end
      and mod(extract(epoch from (p_slot_start - o.occ_start)), c.slot_minutes * 60) = 0 then
      return o.occ_start;
    end if;
  end loop;
  return null;
end;
$$;

-- Vérifie et normalise les champs d'une chaîne (création et modification). p_weekdays est déjà normalisé (null = invalide).
-- Codes : chaine_titre, chaine_texte, chaine_creneau_duree, chaine_periode (once), chaine_recurrence, chaine_jours,
-- chaine_heures (début, fin, durée d'une occurrence de 30 min à 24 h en créneaux entiers), chaine_dates (premier et dernier
-- jour, au plus un an entre les deux, au moins une occurrence), chaine_occurrences (plus de 400), fuseau_invalide.
-- Ne regarde ni « dans le futur » ni « dans les 60 jours » : c'est le rôle de create_adoration_chain et de la
-- modification d'une chaîne qui peut encore changer.
create function public.check_adoration_fields(
  p_title text,
  p_intention text,
  p_place text,
  p_recurrence text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_slot_minutes integer,
  p_timezone text,
  p_weekdays smallint[],
  p_local_start time,
  p_local_end time,
  p_first_on date,
  p_last_on date
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  minutes integer;
  n integer;
begin
  if char_length(btrim(coalesce(p_title, ''))) < 3 or char_length(btrim(p_title)) > 60 then
    raise exception 'chaine_titre';
  end if;
  if char_length(btrim(coalesce(p_intention, ''))) > 280 or char_length(btrim(coalesce(p_place, ''))) > 80 then
    raise exception 'chaine_texte';
  end if;
  if p_slot_minutes is null or p_slot_minutes not in (30, 60) then
    raise exception 'chaine_creneau_duree';
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names z where z.name = p_timezone) then
    raise exception 'fuseau_invalide';
  end if;
  if p_recurrence is null or p_recurrence not in ('once', 'weekly') then
    raise exception 'chaine_recurrence';
  end if;
  if p_recurrence = 'once' then
    if p_starts_at is null or p_ends_at is null
      or p_ends_at - p_starts_at < interval '1 hour'
      or p_ends_at - p_starts_at > interval '7 days'
      or mod((extract(epoch from (p_ends_at - p_starts_at)) / 60)::bigint, p_slot_minutes) <> 0 then
      raise exception 'chaine_periode';
    end if;
    return;
  end if;
  if not public.weekdays_valid(p_weekdays) then
    raise exception 'chaine_jours';
  end if;
  if p_local_start is null or p_local_end is null then
    raise exception 'chaine_heures';
  end if;
  -- Durée d'une occurrence, en minutes de mur : de 30 à 1440, en créneaux entiers.
  minutes := (extract(epoch from (p_local_end - p_local_start)) / 60)::integer;
  if minutes <= 0 then
    minutes := minutes + 1440;
  end if;
  if minutes < 30 or minutes > 1440 or mod(minutes, p_slot_minutes) <> 0 then
    raise exception 'chaine_heures';
  end if;
  if p_first_on is null or p_last_on is null or p_last_on < p_first_on or p_last_on - p_first_on > 366 then
    raise exception 'chaine_dates';
  end if;
  select count(*)::integer into n
  from public.adoration_weekly_occurrences(p_weekdays, p_local_start, p_local_end, p_timezone, p_first_on, p_last_on);
  if n < 1 then
    raise exception 'chaine_dates';
  end if;
  if n > 400 then
    raise exception 'chaine_occurrences';
  end if;
end;
$$;

-- La chaîne sous forme de jsonb, vue par p_uid (déjà vérifié membre du groupe), pour les occurrences qui finissent après
-- p_win_start et commencent avant p_win_end.
--   Champs de la chaîne : id, group_id, group_name, group_ended, can_manage, title, intention, place, recurrence, starts_at,
--     ends_at (bornes), slot_minutes, timezone, weekdays, local_start, local_end ("HH24:MI"), first_on, last_on (null pour
--     once), occurrence_count (toutes), my_slots (mes créneaux non terminés, instants, toutes occurrences), my_next_slot,
--     reserved (au moins un créneau est réservé, par n'importe qui : le rythme ne change plus), has_more (des occurrences
--     commencent à p_win_end ou après).
--   occurrences : [{ start, end, slots: [{ start, count, mine, handles, hidden }] }], dans l'ordre. `count` compte aussi les
--     personnes bloquées ; `handles` : pseudos sans moi ni les personnes bloquées dans un sens ou l'autre, `hidden` : les
--     personnes bloquées (« Un membre »). Sans p_people, `handles` et `hidden` sont omis.
create function public.adoration_chain_json(
  c public.adoration_chains,
  p_uid uuid,
  p_win_start timestamptz,
  p_win_end timestamptz,
  p_people boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  grp public.groups;
  occs jsonb;
  mine jsonb;
  total integer;
  more boolean;
begin
  select * into grp from groups x where x.id = c.group_id;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'start', o.occ_start,
      'end', o.occ_end,
      'slots', (
        select coalesce(jsonb_agg(
          jsonb_build_object('start', s.st, 'count', coalesce(k.cnt, 0), 'mine', coalesce(k.is_mine, false))
          || case when p_people then jsonb_build_object('handles', k.handles, 'hidden', coalesce(k.hidden, 0)) else '{}'::jsonb end
          order by s.st
        ), '[]'::jsonb)
        from generate_series(0, public.adoration_occurrence_slots(c.slot_minutes, o.occ_start, o.occ_end) - 1) as g(i)
        cross join lateral (select o.occ_start + make_interval(mins => g.i * c.slot_minutes) as st) s
        cross join lateral (
          select
            count(*)::integer as cnt,
            coalesce(bool_or(x.user_id = p_uid), false) as is_mine,
            coalesce(
              jsonb_agg(p.handle order by p.handle) filter (where x.user_id <> p_uid and not public.is_blocked(p_uid, x.user_id)),
              '[]'::jsonb
            ) as handles,
            (count(*) filter (where x.user_id <> p_uid and public.is_blocked(p_uid, x.user_id)))::integer as hidden
          from adoration_slots x
          join profiles p on p.id = x.user_id
          where x.chain_id = c.id and x.slot_start = s.st
        ) k
      )
    ) order by o.occ_start
  ), '[]'::jsonb) into occs
  from public.adoration_occurrences(c) o
  where o.occ_end > p_win_start and o.occ_start < p_win_end;
  select coalesce(jsonb_agg(x.slot_start order by x.slot_start), '[]'::jsonb) into mine
  from adoration_slots x
  where x.chain_id = c.id and x.user_id = p_uid and x.slot_start + make_interval(mins => c.slot_minutes) > now();
  select count(*)::integer, coalesce(bool_or(o.occ_start >= p_win_end), false) into total, more
  from public.adoration_occurrences(c) o;
  return jsonb_build_object(
    'id', c.id,
    'group_id', c.group_id,
    'group_name', grp.name,
    'group_ended', public.group_ended(grp.ends_at),
    'can_manage', public.group_role(c.group_id, p_uid) in ('owner', 'moderator'),
    'title', c.title,
    'intention', c.intention,
    'place', c.place,
    'recurrence', c.recurrence,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'slot_minutes', c.slot_minutes,
    'timezone', c.timezone,
    'weekdays', to_jsonb(c.weekdays),
    'local_start', to_char(c.local_start, 'HH24:MI'),
    'local_end', to_char(c.local_end, 'HH24:MI'),
    'first_on', c.first_on,
    'last_on', c.last_on,
    'occurrence_count', total,
    'my_slots', mine,
    'my_next_slot', mine -> 0,
    'reserved', exists (select 1 from adoration_slots x where x.chain_id = c.id),
    'has_more', more,
    'occurrences', occs
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Chaînes d'adoration : créer, modifier
-- ---------------------------------------------------------------------------------------------------------------

-- Codes : groupe_inconnu (pas membre), interdit, plus ceux de check_adoration_fields, et chaine_debut (la première occurrence
-- n'est pas à venir, ou à plus de 60 jours). Messages français : « Ce groupe est terminé », « Cette chaîne doit finir avant
-- la fin du groupe », « Ce groupe a déjà 3 chaînes d’adoration », « Trop de chaînes d’adoration organisées aujourd’hui ».
-- Une chaîne `weekly` ignore p_starts_at et p_ends_at (calculés) ; une chaîne `once` ignore les champs hebdomadaires.
create function public.create_adoration_chain(
  p_group uuid,
  p_title text,
  p_intention text,
  p_place text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_slot_minutes integer,
  p_timezone text,
  p_recurrence text default 'once',
  p_weekdays integer[] default null,
  p_local_start time default null,
  p_local_end time default null,
  p_first_on date default null,
  p_last_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_group, uid);
  rec text := coalesce(p_recurrence, 'once');
  weekly boolean := coalesce(p_recurrence, 'once') = 'weekly';
  days smallint[] := case when coalesce(p_recurrence, 'once') = 'weekly' then public.normalize_weekdays(p_weekdays) end;
  ls time := case when p_local_start is null then null else make_time(extract(hour from p_local_start)::integer, extract(minute from p_local_start)::integer, 0) end;
  le time := case when p_local_end is null then null else make_time(extract(hour from p_local_end)::integer, extract(minute from p_local_end)::integer, 0) end;
  v_start timestamptz := p_starts_at;
  v_end timestamptz := p_ends_at;
  ends timestamptz;
  new_id uuid;
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  -- Verrou sur le groupe : la limite de 3 chaînes tient sous concurrence.
  select g.ends_at into ends from groups g where g.id = p_group for update;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  perform public.check_adoration_fields(p_title, p_intention, p_place, rec, p_starts_at, p_ends_at, p_slot_minutes, p_timezone, days, ls, le, p_first_on, p_last_on);
  if weekly then
    select min(o.occ_start), max(o.occ_end) into v_start, v_end
    from public.adoration_weekly_occurrences(days, ls, le, p_timezone, p_first_on, p_last_on) o;
  end if;
  if v_start <= now() or v_start > now() + interval '60 days' then
    raise exception 'chaine_debut';
  end if;
  if ends is not null and v_end > ends then
    raise exception 'Cette chaîne doit finir avant la fin du groupe';
  end if;
  if (
    select count(*) from adoration_chains x
    where x.group_id = p_group and x.cancelled_at is null and x.ends_at > now()
  ) >= 3 then
    raise exception 'Ce groupe a déjà 3 chaînes d’adoration';
  end if;
  if (
    select count(*) from daily_posts d
    where d.user_id = uid and d.kind = 'adoration' and d.created_at > now() - interval '1 day'
  ) >= 3 then
    raise exception 'Trop de chaînes d’adoration organisées aujourd’hui';
  end if;
  insert into adoration_chains (
    group_id, title, intention, place, starts_at, ends_at, slot_minutes, timezone, created_by,
    recurrence, weekdays, local_start, local_end, first_on, last_on
  )
  values (
    p_group, btrim(p_title), btrim(coalesce(p_intention, '')), btrim(coalesce(p_place, '')), v_start, v_end, p_slot_minutes, p_timezone, uid,
    rec,
    case when weekly then days end,
    case when weekly then ls end,
    case when weekly then le end,
    case when weekly then p_first_on end,
    case when weekly then p_last_on end
  )
  returning id into new_id;
  insert into daily_posts (user_id, kind) values (uid, 'adoration');
  return new_id;
end;
$$;

-- Propriétaire ou modérateur du groupe de la chaîne. Code : chaine_inconnue. Messages : « Ce groupe est terminé »,
-- « Cette chaîne est terminée », « Cette chaîne garde sa forme : ponctuelle ou hebdomadaire »,
-- « Cette chaîne a commencé ou a des créneaux réservés : son rythme ne change plus, seule sa fin peut être repoussée »,
-- « Cette chaîne a commencé ou a des créneaux réservés : sa fin ne peut que être repoussée » (voir l'en-tête pour le choix
-- fait sur les réservations). Le fuseau enregistré ne change que tant que la chaîne peut encore changer de rythme.
create function public.update_adoration_chain(
  p_id uuid,
  p_title text,
  p_intention text,
  p_place text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_slot_minutes integer,
  p_timezone text,
  p_recurrence text default 'once',
  p_weekdays integer[] default null,
  p_local_start time default null,
  p_local_end time default null,
  p_first_on date default null,
  p_last_on date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  c public.adoration_chains;
  r text;
  ends timestamptz;
  rec text := coalesce(p_recurrence, 'once');
  weekly boolean := coalesce(p_recurrence, 'once') = 'weekly';
  days smallint[] := case when coalesce(p_recurrence, 'once') = 'weekly' then public.normalize_weekdays(p_weekdays) end;
  ls time := case when p_local_start is null then null else make_time(extract(hour from p_local_start)::integer, extract(minute from p_local_start)::integer, 0) end;
  le time := case when p_local_end is null then null else make_time(extract(hour from p_local_end)::integer, extract(minute from p_local_end)::integer, 0) end;
  v_start timestamptz := p_starts_at;
  v_end timestamptz := p_ends_at;
  locked boolean;
  tz text := p_timezone;
begin
  select * into c from adoration_chains x where x.id = p_id and x.cancelled_at is null for update;
  r := case when found then public.group_role(c.group_id, uid) end;
  if r is null then
    raise exception 'chaine_inconnue';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  select g.ends_at into ends from groups g where g.id = c.group_id;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  if c.ends_at <= now() then
    raise exception 'Cette chaîne est terminée';
  end if;
  if rec <> c.recurrence then
    raise exception 'Cette chaîne garde sa forme : ponctuelle ou hebdomadaire';
  end if;
  locked := c.starts_at <= now() or exists (select 1 from adoration_slots s where s.chain_id = p_id);
  if locked then
    -- Le rythme est figé : on compare avec ce qui est enregistré, le fuseau enregistré fait foi.
    tz := c.timezone;
  end if;
  perform public.check_adoration_fields(p_title, p_intention, p_place, rec, p_starts_at, p_ends_at, p_slot_minutes, tz, days, ls, le, p_first_on, p_last_on);
  if weekly then
    select min(o.occ_start), max(o.occ_end) into v_start, v_end
    from public.adoration_weekly_occurrences(days, ls, le, tz, p_first_on, p_last_on) o;
  end if;
  if locked then
    if p_slot_minutes <> c.slot_minutes
      or (not weekly and p_starts_at <> c.starts_at)
      or (weekly and (days <> c.weekdays or ls <> c.local_start or le <> c.local_end or p_first_on <> c.first_on)) then
      raise exception 'Cette chaîne a commencé ou a des créneaux réservés : son rythme ne change plus, seule sa fin peut être repoussée';
    end if;
    if v_end < c.ends_at then
      raise exception 'Cette chaîne a commencé ou a des créneaux réservés : sa fin peut seulement être repoussée';
    end if;
  else
    if v_start <= now() or v_start > now() + interval '60 days' then
      raise exception 'chaine_debut';
    end if;
  end if;
  if ends is not null and v_end > ends then
    raise exception 'Cette chaîne doit finir avant la fin du groupe';
  end if;
  update adoration_chains set
    title = btrim(p_title),
    intention = btrim(coalesce(p_intention, '')),
    place = btrim(coalesce(p_place, '')),
    starts_at = v_start,
    ends_at = v_end,
    slot_minutes = p_slot_minutes,
    timezone = tz,
    weekdays = case when weekly then days end,
    local_start = case when weekly then ls end,
    local_end = case when weekly then le end,
    first_on = case when weekly then p_first_on end,
    last_on = case when weekly then p_last_on end
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Chaînes d'adoration : lectures (tout membre)
-- ---------------------------------------------------------------------------------------------------------------

-- Les chaînes du groupe à venir, en cours, ou terminées depuis moins de 2 jours (tableau jsonb, voir adoration_chain_json).
-- Chaque chaîne ne porte que son occurrence en cours ou la prochaine (la dernière si elle est finie), sans les pseudos : de
-- quoi faire les cartes. Même signature qu'en 013 : `create or replace` garde les droits. Code : groupe_inconnu.
create or replace function public.list_adoration_chains(p_group uuid)
returns jsonb
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
  return coalesce((
    select jsonb_agg(public.adoration_chain_json(c, uid, t.ref, t.ref + interval '1 second', false) order by c.starts_at, c.id)
    from adoration_chains c
    cross join lateral (
      select coalesce(
        (select min(o.occ_start) from public.adoration_occurrences(c) o where o.occ_end > now()),
        (select max(o.occ_start) from public.adoration_occurrences(c) o)
      ) as ref
    ) t
    where c.group_id = p_group and c.cancelled_at is null and c.ends_at > now() - interval '2 days'
  ), '[]'::jsonb);
end;
$$;

-- Une chaîne par son identifiant (détail, ouverture depuis un rappel) : une FENÊTRE d'occurrences, de p_from (jour local de la
-- chaîne ; par défaut aujourd'hui, ramené entre le premier et le dernier jour) pendant p_weeks semaines (1 à 12, 4 par
-- défaut). Une chaîne `once` renvoie toujours son unique occurrence. Ajoute window_from et window_to (jours, fin exclue) pour
-- une hebdomadaire. Code : chaine_inconnue (inconnue, annulée, ou je ne suis pas membre du groupe).
create function public.get_adoration_chain(p_id uuid, p_from date default null, p_weeks integer default 4)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  c public.adoration_chains;
  weeks integer := least(greatest(coalesce(p_weeks, 4), 1), 12);
  from_d date;
  to_d date;
  res jsonb;
begin
  select * into c from adoration_chains x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(c.group_id, uid) is null then
    raise exception 'chaine_inconnue';
  end if;
  if c.recurrence = 'once' then
    return public.adoration_chain_json(c, uid, '-infinity'::timestamptz, 'infinity'::timestamptz, true);
  end if;
  from_d := coalesce(p_from, least(greatest(c.first_on, (now() at time zone c.timezone)::date), c.last_on));
  to_d := from_d + weeks * 7;
  res := public.adoration_chain_json(c, uid, from_d::timestamp at time zone c.timezone, to_d::timestamp at time zone c.timezone, true);
  return res || jsonb_build_object('window_from', from_d, 'window_to', to_d);
end;
$$;

-- Mes prochains créneaux (en cours ou à venir, toutes chaînes confondues), dans les groupes où je suis encore membre et qui ne
-- sont pas terminés : de quoi programmer les rappels et montrer l'accueil. 12 au plus, le plus proche d'abord. Tableau jsonb
-- de { chain_id, group_id, group_name, title, place, timezone, slot_minutes, starts_at, ends_at } (starts_at est le slot_start,
-- ends_at sa fin). Même signature qu'en 013 : `create or replace` garde les droits.
create or replace function public.my_adoration_slots()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'chain_id', t.chain_id,
        'group_id', t.group_id,
        'group_name', t.group_name,
        'title', t.title,
        'place', t.place,
        'timezone', t.timezone,
        'slot_minutes', t.slot_minutes,
        'starts_at', t.slot_start,
        'ends_at', t.slot_start + make_interval(mins => t.slot_minutes)
      )
      order by t.slot_start, t.chain_id
    )
    from (
      select
        c.id as chain_id,
        c.group_id,
        gr.name as group_name,
        c.title,
        c.place,
        c.timezone,
        c.slot_minutes::integer as slot_minutes,
        s.slot_start
      from adoration_slots s
      join adoration_chains c on c.id = s.chain_id
      join groups gr on gr.id = c.group_id
      join group_members gm on gm.group_id = c.group_id and gm.user_id = uid
      where s.user_id = uid
        and c.cancelled_at is null
        and not public.group_ended(gr.ends_at)
        and s.slot_start + make_interval(mins => c.slot_minutes) > now()
        and public.adoration_slot_occurrence(c, s.slot_start) is not null
      order by s.slot_start, c.id
      limit 12
    ) t
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Chaînes d'adoration : réservations
-- ---------------------------------------------------------------------------------------------------------------

-- Les trois fonctions qui suivent renvoient la chaîne avec la seule occurrence du créneau touché (le téléphone la remplace
-- dans sa liste), pseudos compris.

-- Réserver un créneau (tout membre). Idempotent si je l'ai déjà. Codes : chaine_inconnue, creneau_invalide (p_slot_start ne
-- tombe pas sur un créneau d'une occurrence). Messages : « Ce groupe est terminé », « Ce créneau est déjà passé »,
-- « Ce créneau est complet » (10 adorateurs), « Tu as déjà 12 créneaux sur cette chaîne » (non terminés, toutes occurrences).
create function public.reserve_slot(p_chain uuid, p_slot_start timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  c public.adoration_chains;
  ends timestamptz;
  occ timestamptz;
begin
  -- Verrou sur la chaîne : les limites de 10 et de 12 tiennent sous concurrence.
  select * into c from adoration_chains x where x.id = p_chain and x.cancelled_at is null for update;
  if not found or public.group_role(c.group_id, uid) is null then
    raise exception 'chaine_inconnue';
  end if;
  select gr.ends_at into ends from groups gr where gr.id = c.group_id;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  occ := public.adoration_slot_occurrence(c, p_slot_start);
  if occ is null then
    raise exception 'creneau_invalide';
  end if;
  if p_slot_start + make_interval(mins => c.slot_minutes) <= now() then
    raise exception 'Ce créneau est déjà passé';
  end if;
  if exists (select 1 from adoration_slots s where s.chain_id = p_chain and s.slot_start = p_slot_start and s.user_id = uid) then
    return public.adoration_chain_json(c, uid, occ, occ + interval '1 second', true);
  end if;
  if (select count(*) from adoration_slots s where s.chain_id = p_chain and s.slot_start = p_slot_start) >= 10 then
    raise exception 'Ce créneau est complet';
  end if;
  if (
    select count(*) from adoration_slots s
    where s.chain_id = p_chain and s.user_id = uid and s.slot_start + make_interval(mins => c.slot_minutes) > now()
  ) >= 12 then
    raise exception 'Tu as déjà 12 créneaux sur cette chaîne';
  end if;
  insert into adoration_slots (chain_id, slot_start, user_id) values (p_chain, p_slot_start, uid);
  return public.adoration_chain_json(c, uid, occ, occ + interval '1 second', true);
end;
$$;

-- Libérer mon créneau, tant qu'il n'est pas terminé. Possible aussi dans un groupe terminé. Codes : chaine_inconnue,
-- creneau_invalide. Message : « Ce créneau est déjà passé ».
create function public.release_slot(p_chain uuid, p_slot_start timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  c public.adoration_chains;
  occ timestamptz;
begin
  select * into c from adoration_chains x where x.id = p_chain and x.cancelled_at is null for update;
  if not found or public.group_role(c.group_id, uid) is null then
    raise exception 'chaine_inconnue';
  end if;
  occ := public.adoration_slot_occurrence(c, p_slot_start);
  if occ is null then
    raise exception 'creneau_invalide';
  end if;
  if p_slot_start + make_interval(mins => c.slot_minutes) <= now() then
    raise exception 'Ce créneau est déjà passé';
  end if;
  delete from adoration_slots s where s.chain_id = p_chain and s.slot_start = p_slot_start and s.user_id = uid;
  return public.adoration_chain_json(c, uid, occ, occ + interval '1 second', true);
end;
$$;

-- Modération : retirer la réservation d'un autre membre (propriétaire ou modérateur ; un modérateur ne retire pas celle du
-- propriétaire). Codes : chaine_inconnue, creneau_invalide, interdit. Messages : « Ce groupe est terminé »,
-- « Ce créneau est déjà passé », « Cette personne n’a pas réservé ce créneau ».
create function public.remove_slot_reservation(p_chain uuid, p_slot_start timestamptz, p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  c public.adoration_chains;
  r text;
  ends timestamptz;
  occ timestamptz;
  target uuid;
  target_role text;
begin
  select * into c from adoration_chains x where x.id = p_chain and x.cancelled_at is null for update;
  r := case when found then public.group_role(c.group_id, uid) end;
  if r is null then
    raise exception 'chaine_inconnue';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  select gr.ends_at into ends from groups gr where gr.id = c.group_id;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  occ := public.adoration_slot_occurrence(c, p_slot_start);
  if occ is null then
    raise exception 'creneau_invalide';
  end if;
  if p_slot_start + make_interval(mins => c.slot_minutes) <= now() then
    raise exception 'Ce créneau est déjà passé';
  end if;
  select p.id into target from profiles p where p.handle = lower(btrim(coalesce(p_handle, '')));
  if target is null or not exists (
    select 1 from adoration_slots s where s.chain_id = p_chain and s.slot_start = p_slot_start and s.user_id = target
  ) then
    raise exception 'Cette personne n’a pas réservé ce créneau';
  end if;
  target_role := public.group_role(c.group_id, target);
  if target <> uid and r = 'moderator' and target_role = 'owner' then
    raise exception 'interdit';
  end if;
  delete from adoration_slots s where s.chain_id = p_chain and s.slot_start = p_slot_start and s.user_id = target;
  return public.adoration_chain_json(c, uid, occ, occ + interval '1 second', true);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Droits : mêmes règles qu'en 009, 010 et 013. Aides internes fermées, fonctions de l'app ouvertes aux comptes connectés
-- seulement.
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function public.weekdays_valid(smallint[]) from public, anon, authenticated;
revoke all on function public.normalize_weekdays(integer[], integer) from public, anon, authenticated;
revoke all on function public.weekly_last_start(smallint[], time, text, date, timestamptz) from public, anon, authenticated;
revoke all on function public.weekly_next_start(smallint[], time, text, date, timestamptz) from public, anon, authenticated;
revoke all on function public.gathering_last_start(public.group_gatherings, timestamptz) from public, anon, authenticated;
revoke all on function public.gathering_next_occurrence(public.group_gatherings, timestamptz) from public, anon, authenticated;
revoke all on function public.check_gathering_fields(text, text, integer, text, smallint[], time, text, timestamptz, date) from public, anon, authenticated;
revoke all on function public.adoration_weekly_occurrences(smallint[], time, time, text, date, date) from public, anon, authenticated;
revoke all on function public.adoration_occurrences(public.adoration_chains) from public, anon, authenticated;
revoke all on function public.adoration_occurrence_slots(integer, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.adoration_slot_occurrence(public.adoration_chains, timestamptz) from public, anon, authenticated;
revoke all on function public.check_adoration_fields(text, text, text, text, timestamptz, timestamptz, integer, text, smallint[], time, time, date, date) from public, anon, authenticated;
revoke all on function public.adoration_chain_json(public.adoration_chains, uuid, timestamptz, timestamptz, boolean) from public, anon, authenticated;

revoke all on function public.create_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text, integer[], date) from public, anon, authenticated;
revoke all on function public.update_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text, integer[], date) from public, anon, authenticated;
revoke all on function public.list_gatherings(uuid) from public, anon, authenticated;
revoke all on function public.my_gatherings() from public, anon, authenticated;
revoke all on function public.create_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text, text, integer[], time, time, date, date) from public, anon, authenticated;
revoke all on function public.update_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text, text, integer[], time, time, date, date) from public, anon, authenticated;
revoke all on function public.list_adoration_chains(uuid) from public, anon, authenticated;
revoke all on function public.get_adoration_chain(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.my_adoration_slots() from public, anon, authenticated;
revoke all on function public.reserve_slot(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.release_slot(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.remove_slot_reservation(uuid, timestamptz, text) from public, anon, authenticated;

grant execute on function public.create_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text, integer[], date) to authenticated;
grant execute on function public.update_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text, integer[], date) to authenticated;
grant execute on function public.list_gatherings(uuid) to authenticated;
grant execute on function public.my_gatherings() to authenticated;
grant execute on function public.create_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text, text, integer[], time, time, date, date) to authenticated;
grant execute on function public.update_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text, text, integer[], time, time, date, date) to authenticated;
grant execute on function public.list_adoration_chains(uuid) to authenticated;
grant execute on function public.get_adoration_chain(uuid, date, integer) to authenticated;
grant execute on function public.my_adoration_slots() to authenticated;
grant execute on function public.reserve_slot(uuid, timestamptz) to authenticated;
grant execute on function public.release_slot(uuid, timestamptz) to authenticated;
grant execute on function public.remove_slot_reservation(uuid, timestamptz, text) to authenticated;
