-- Chaîne d'adoration de groupe, avec créneaux à réserver.
--
-- Une chaîne appartient à un groupe (non terminé) et est créée, modifiée et annulée par un propriétaire ou un modérateur :
-- titre (3 à 60), intention facultative (280 au plus), lieu facultatif (80 au plus ; vide = chacun adore là où il est), début et
-- fin (instants), fuseau IANA du créateur (validé contre pg_timezone_names, comme 009 et 011) et durée de créneau de 30 ou
-- 60 minutes. La durée totale va de 1 h à 7 jours et la fin tombe sur un créneau entier. Le début est dans les 60 prochains
-- jours. Dans un groupe éphémère, la fin ne dépasse pas ends_at. Un groupe a 3 chaînes à venir ou en cours au plus ; un
-- créateur peut en créer 3 par jour (daily_posts, nouveau type 'adoration').
--
-- Créneaux IMPLICITES : il n'y a pas de ligne par créneau, seulement des réservations. Le créneau d'index i (0 à N-1) commence à
-- starts_at + i x slot_minutes minutes et finit slot_minutes minutes plus tard. Ce sont des instants absolus : les changements
-- d'heure d'été et d'hiver n'y changent rien (un créneau dure toujours 30 ou 60 minutes). Le téléphone fait le même découpage en
-- pur (src/adoration-chain.ts, testé) ; le serveur reste la référence pour accepter une action.
--
-- Réserver (reserve_slot) : tout membre du groupe, un créneau qui n'est pas terminé ; plusieurs personnes peuvent adorer sur le
-- même créneau (10 au plus) ; une personne a 12 créneaux non terminés au plus par chaîne. Libérer (release_slot) : sa propre
-- réservation, tant que le créneau n'est pas terminé (l'historique de couverture d'un créneau passé ne bouge plus). Retirer la
-- réservation d'un autre (remove_slot_reservation) : propriétaire ou modérateur (un modérateur ne retire pas celle du
-- propriétaire). La chaîne est verrouillée (for update) pendant une réservation : les limites de 10 et de 12 tiennent sous
-- concurrence, et la clé primaire (chain_id, slot_index, user_id) empêche le doublon.
--
-- Modifier (update_adoration_chain) : le titre, l'intention et le lieu changent toujours. TANT QUE DES CRÉNEAUX SONT RÉSERVÉS, le
-- début et la durée des créneaux ne changent plus (un index réservé changerait de moment en silence), et la fin ne peut pas
-- reculer en dessous du dernier créneau réservé ; elle peut toujours avancer (la chaîne s'allonge). Aucune réservation n'est donc
-- jamais libérée par une modification. Une chaîne déjà commencée garde son début ; une chaîne terminée ne se modifie plus.
--
-- Qui voit quoi : seuls les membres du groupe voient la chaîne. Les membres d'un groupe voient déjà leurs pseudos (list_members,
-- 008) : chaque créneau porte donc les pseudos de ses adorateurs, sauf si l'un des deux a bloqué l'autre (is_blocked, 007) :
-- l'adorateur est alors compté mais sans pseudo (« hidden »), l'app écrit « Un membre ». Mes propres réservations sont signalées
-- par `mine`, mon pseudo n'est pas répété dans la liste.
-- Les rappels sont LOCAUX (sur le téléphone) : le serveur ne pousse rien.
--
-- Les tables ne sont pas lisibles directement (RLS sans politique, droits retirés) : tout passe par les fonctions ci-dessous.
--
-- delete_my_account (004) : supprimer auth.users emporte les adoration_slots de la personne par on delete cascade ;
--   adoration_chains.created_by passe à null (la chaîne reste au groupe). daily_posts est vidé par delete_my_account (le nouveau
--   type 'adoration' compris). Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme n'est membre de rien et ne réserve rien.
-- Départ d'un membre (quitter, exclusion) : le trigger group_members_adoration_cleanup (ci-dessous) retire ses réservations
--   (créneaux libérés, rappels arrêtés à la prochaine synchronisation) ; les triggers de 008, 009, 011 et 012 ne sont pas
--   modifiés.

create table public.adoration_chains (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  intention text not null default '',
  place text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  slot_minutes smallint not null,
  timezone text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint adoration_chains_title_len check (char_length(btrim(title)) between 3 and 60),
  constraint adoration_chains_intention_len check (char_length(intention) <= 280),
  constraint adoration_chains_place_len check (char_length(place) <= 80),
  constraint adoration_chains_slot check (slot_minutes in (30, 60)),
  constraint adoration_chains_span check (
    ends_at - starts_at between interval '1 hour' and interval '7 days'
    and mod((extract(epoch from (ends_at - starts_at)) / 60)::bigint, slot_minutes) = 0
  )
);

create index adoration_chains_group_idx on public.adoration_chains (group_id) where cancelled_at is null;

create table public.adoration_slots (
  chain_id uuid not null references public.adoration_chains (id) on delete cascade,
  slot_index smallint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chain_id, slot_index, user_id),
  constraint adoration_slots_index check (slot_index between 0 and 335)
);

create index adoration_slots_user_idx on public.adoration_slots (chain_id, user_id);

alter table public.adoration_chains enable row level security;
alter table public.adoration_slots enable row level security;

revoke all on table public.adoration_chains from anon, authenticated;
revoke all on table public.adoration_slots from anon, authenticated;

-- Organiser une chaîne compte dans une limite quotidienne, comme les groupes, les intentions, les neuvaines et les Rosaires.
-- On remplace la contrainte de 012 en gardant tous ses types et en ajoutant 'adoration'.
alter table public.daily_posts drop constraint if exists daily_posts_kind_check;
alter table public.daily_posts
  add constraint daily_posts_kind_check
  check (kind in ('echo', 'intention', 'follow', 'group', 'group_intention', 'code_try', 'novena', 'rosary', 'adoration'));

-- ---------------------------------------------------------------------------------------------------------------
-- Aides internes : pas de droit d'exécution pour les clients.
-- ---------------------------------------------------------------------------------------------------------------

-- Nombre de créneaux de la chaîne.
create or replace function public.adoration_slot_count(c public.adoration_chains)
returns integer
language sql
immutable
set search_path = public
as $$
  select ((extract(epoch from (c.ends_at - c.starts_at)) / 60)::bigint / c.slot_minutes)::integer;
$$;

-- Début du créneau d'index p_index (instant absolu).
create or replace function public.adoration_slot_start(c public.adoration_chains, p_index integer)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select c.starts_at + make_interval(mins => p_index * c.slot_minutes);
$$;

-- Fin du créneau d'index p_index.
create or replace function public.adoration_slot_end(c public.adoration_chains, p_index integer)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select c.starts_at + make_interval(mins => (p_index + 1) * c.slot_minutes);
$$;

-- Vérifie et normalise les champs d'une chaîne (création et modification).
-- Codes : chaine_titre, chaine_texte, chaine_creneau_duree, chaine_periode, fuseau_invalide.
create or replace function public.check_adoration_fields(
  p_title text,
  p_intention text,
  p_place text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_slot_minutes integer,
  p_timezone text
)
returns void
language plpgsql
stable
set search_path = public
as $$
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
  if p_starts_at is null or p_ends_at is null
    or p_ends_at - p_starts_at < interval '1 hour'
    or p_ends_at - p_starts_at > interval '7 days'
    or mod((extract(epoch from (p_ends_at - p_starts_at)) / 60)::bigint, p_slot_minutes) <> 0 then
    raise exception 'chaine_periode';
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names z where z.name = p_timezone) then
    raise exception 'fuseau_invalide';
  end if;
end;
$$;

-- La chaîne sous forme de jsonb, vue par p_uid (déjà vérifié membre du groupe).
--   counts : pour chaque créneau (index 0 à N-1), le nombre d'adorateurs (blocages compris : on compte, sans nommer).
--   mine_slots : les index de mes créneaux.
--   slots : seulement les créneaux qui ont au moins un adorateur : { index, handles (pseudos, sans moi ni les personnes
--     bloquées dans un sens ou l'autre), hidden (personnes bloquées : « Un membre ») }.
create or replace function public.adoration_chain_json(c public.adoration_chains, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  grp public.groups;
  n integer := public.adoration_slot_count(c);
  counts jsonb;
  mine jsonb;
  slots jsonb;
begin
  select * into grp from groups x where x.id = c.group_id;
  select coalesce(jsonb_agg(coalesce(k.cnt, 0) order by s.i), '[]'::jsonb) into counts
  from generate_series(0, n - 1) as s(i)
  left join (
    select x.slot_index as i, count(*)::integer as cnt
    from adoration_slots x
    where x.chain_id = c.id
    group by x.slot_index
  ) k on k.i = s.i;
  select coalesce(jsonb_agg(x.slot_index order by x.slot_index), '[]'::jsonb) into mine
  from adoration_slots x
  where x.chain_id = c.id and x.user_id = p_uid and x.slot_index < n;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'index', g.slot_index,
      'handles', g.handles,
      'hidden', g.hidden
    ) order by g.slot_index
  ), '[]'::jsonb) into slots
  from (
    select
      x.slot_index,
      coalesce(
        jsonb_agg(p.handle order by p.handle) filter (where x.user_id <> p_uid and not public.is_blocked(p_uid, x.user_id)),
        '[]'::jsonb
      ) as handles,
      (count(*) filter (where x.user_id <> p_uid and public.is_blocked(p_uid, x.user_id)))::integer as hidden
    from adoration_slots x
    join profiles p on p.id = x.user_id
    where x.chain_id = c.id and x.slot_index < n
    group by x.slot_index
  ) g;
  return jsonb_build_object(
    'id', c.id,
    'group_id', c.group_id,
    'group_name', grp.name,
    'group_ended', public.group_ended(grp.ends_at),
    'can_manage', public.group_role(c.group_id, p_uid) in ('owner', 'moderator'),
    'title', c.title,
    'intention', c.intention,
    'place', c.place,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'slot_minutes', c.slot_minutes,
    'timezone', c.timezone,
    'slot_count', n,
    'counts', counts,
    'mine_slots', mine,
    'slots', slots
  );
end;
$$;

-- Départ d'un membre du groupe : ses réservations à ce groupe disparaissent. Trigger dédié : les triggers de 008, 009, 011 et
-- 012 restent tels quels.
create or replace function public.group_members_adoration_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from adoration_slots s
  using adoration_chains c
  where s.chain_id = c.id and c.group_id = old.group_id and s.user_id = old.user_id;
  return old;
end;
$$;

create trigger group_members_adoration_cleanup
  after delete on public.group_members
  for each row execute function public.group_members_adoration_cleanup();

-- ---------------------------------------------------------------------------------------------------------------
-- Créer, modifier, annuler (propriétaire ou modérateur)
-- ---------------------------------------------------------------------------------------------------------------

-- Codes : groupe_inconnu (pas membre), interdit, plus ceux de check_adoration_fields, et chaine_debut (début passé ou à plus de
-- 60 jours). Messages français : « Ce groupe est terminé », « Cette chaîne doit finir avant la fin du groupe »,
-- « Ce groupe a déjà 3 chaînes d’adoration », « Trop de chaînes d’adoration organisées aujourd’hui ».
create or replace function public.create_adoration_chain(
  p_group uuid,
  p_title text,
  p_intention text,
  p_place text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_slot_minutes integer,
  p_timezone text
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
  -- Verrou sur le groupe : la limite de 3 chaînes tient sous concurrence.
  select g.ends_at into ends from groups g where g.id = p_group for update;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  perform public.check_adoration_fields(p_title, p_intention, p_place, p_starts_at, p_ends_at, p_slot_minutes, p_timezone);
  if p_starts_at <= now() or p_starts_at > now() + interval '60 days' then
    raise exception 'chaine_debut';
  end if;
  if ends is not null and p_ends_at > ends then
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
  insert into adoration_chains (group_id, title, intention, place, starts_at, ends_at, slot_minutes, timezone, created_by)
  values (p_group, btrim(p_title), btrim(coalesce(p_intention, '')), btrim(coalesce(p_place, '')), p_starts_at, p_ends_at, p_slot_minutes, p_timezone, uid)
  returning id into new_id;
  insert into daily_posts (user_id, kind) values (uid, 'adoration');
  return new_id;
end;
$$;

-- Propriétaire ou modérateur du groupe de la chaîne. Code : chaine_inconnue. Messages : « Ce groupe est terminé »,
-- « Cette chaîne est terminée », « Cette chaîne a déjà commencé : son début ne change plus »,
-- « Des créneaux sont réservés : le début et la durée des créneaux ne changent plus »,
-- « Des créneaux réservés sont après cette nouvelle fin ». Voir l'en-tête pour le choix fait sur les réservations.
-- Le fuseau enregistré ne change que si le début ou la fin change (c'est le fuseau dans lequel ces heures ont été choisies).
create or replace function public.update_adoration_chain(
  p_id uuid,
  p_title text,
  p_intention text,
  p_place text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_slot_minutes integer,
  p_timezone text
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
  new_count integer;
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
  perform public.check_adoration_fields(p_title, p_intention, p_place, p_starts_at, p_ends_at, p_slot_minutes, p_timezone);
  if p_starts_at <> c.starts_at then
    if c.starts_at <= now() then
      raise exception 'Cette chaîne a déjà commencé : son début ne change plus';
    end if;
    if p_starts_at <= now() or p_starts_at > now() + interval '60 days' then
      raise exception 'chaine_debut';
    end if;
  end if;
  if p_ends_at <= now() then
    raise exception 'Cette chaîne doit finir dans le futur';
  end if;
  if ends is not null and p_ends_at > ends then
    raise exception 'Cette chaîne doit finir avant la fin du groupe';
  end if;
  if exists (select 1 from adoration_slots s where s.chain_id = p_id) then
    if p_starts_at <> c.starts_at or p_slot_minutes <> c.slot_minutes then
      raise exception 'Des créneaux sont réservés : le début et la durée des créneaux ne changent plus';
    end if;
    new_count := ((extract(epoch from (p_ends_at - p_starts_at)) / 60)::bigint / p_slot_minutes)::integer;
    if exists (select 1 from adoration_slots s where s.chain_id = p_id and s.slot_index >= new_count) then
      raise exception 'Des créneaux réservés sont après cette nouvelle fin';
    end if;
  end if;
  update adoration_chains set
    title = btrim(p_title),
    intention = btrim(coalesce(p_intention, '')),
    place = btrim(coalesce(p_place, '')),
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    slot_minutes = p_slot_minutes,
    timezone = case when p_starts_at <> c.starts_at or p_ends_at <> c.ends_at then p_timezone else c.timezone end
  where id = p_id;
end;
$$;

-- Propriétaire ou modérateur, aussi dans un groupe terminé. Les réservations sont conservées mais ne sont plus lues. Code :
-- chaine_inconnue.
create or replace function public.cancel_adoration_chain(p_id uuid)
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
  select x.group_id into gid from adoration_chains x where x.id = p_id and x.cancelled_at is null;
  r := case when gid is null then null else public.group_role(gid, uid) end;
  if r is null then
    raise exception 'chaine_inconnue';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  update adoration_chains set cancelled_at = now() where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Lecture (tout membre)
-- ---------------------------------------------------------------------------------------------------------------

-- Les chaînes du groupe à venir, en cours, ou terminées depuis moins de 2 jours (tableau jsonb, voir adoration_chain_json ;
-- `slots` est omis dans la liste : seuls `counts` et `mine_slots` servent aux cartes). Code : groupe_inconnu.
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
    select jsonb_agg((public.adoration_chain_json(c, uid) - 'slots') order by c.starts_at, c.id)
    from adoration_chains c
    where c.group_id = p_group and c.cancelled_at is null and c.ends_at > now() - interval '2 days'
  ), '[]'::jsonb);
end;
$$;

-- Une chaîne par son identifiant (détail complet, ouverture depuis un rappel). Code : chaine_inconnue (inconnue, annulée, ou je
-- ne suis pas membre du groupe).
create or replace function public.get_adoration_chain(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  c public.adoration_chains;
begin
  select * into c from adoration_chains x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(c.group_id, uid) is null then
    raise exception 'chaine_inconnue';
  end if;
  return public.adoration_chain_json(c, uid);
end;
$$;

-- Mes prochains créneaux (en cours ou à venir, toutes chaînes confondues), dans les groupes où je suis encore membre et qui ne
-- sont pas terminés : de quoi programmer les rappels et montrer l'accueil. 12 au plus, le plus proche d'abord. Tableau jsonb.
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
        'slot_index', t.slot_index,
        'slot_minutes', t.slot_minutes,
        'starts_at', t.slot_start,
        'ends_at', t.slot_end
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
        s.slot_index,
        c.slot_minutes,
        public.adoration_slot_start(c, s.slot_index) as slot_start,
        public.adoration_slot_end(c, s.slot_index) as slot_end
      from adoration_slots s
      join adoration_chains c on c.id = s.chain_id
      join groups gr on gr.id = c.group_id
      join group_members gm on gm.group_id = c.group_id and gm.user_id = uid
      where s.user_id = uid
        and c.cancelled_at is null
        and not public.group_ended(gr.ends_at)
        and public.adoration_slot_end(c, s.slot_index) > now()
      order by public.adoration_slot_start(c, s.slot_index), c.id
      limit 12
    ) t
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Réservations
-- ---------------------------------------------------------------------------------------------------------------

-- Réserver un créneau (tout membre). Idempotent si je l'ai déjà. Renvoie la chaîne (voir adoration_chain_json).
-- Codes : chaine_inconnue, creneau_invalide. Messages : « Ce groupe est terminé », « Ce créneau est déjà passé »,
-- « Ce créneau est complet » (10 adorateurs), « Tu as déjà 12 créneaux sur cette chaîne » (non terminés).
create or replace function public.reserve_slot(p_chain uuid, p_index integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  c public.adoration_chains;
  ends timestamptz;
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
  if p_index is null or p_index < 0 or p_index >= public.adoration_slot_count(c) then
    raise exception 'creneau_invalide';
  end if;
  if public.adoration_slot_end(c, p_index) <= now() then
    raise exception 'Ce créneau est déjà passé';
  end if;
  if exists (select 1 from adoration_slots s where s.chain_id = p_chain and s.slot_index = p_index and s.user_id = uid) then
    return public.adoration_chain_json(c, uid);
  end if;
  if (select count(*) from adoration_slots s where s.chain_id = p_chain and s.slot_index = p_index) >= 10 then
    raise exception 'Ce créneau est complet';
  end if;
  if (
    select count(*) from adoration_slots s
    where s.chain_id = p_chain and s.user_id = uid and public.adoration_slot_end(c, s.slot_index) > now()
  ) >= 12 then
    raise exception 'Tu as déjà 12 créneaux sur cette chaîne';
  end if;
  insert into adoration_slots (chain_id, slot_index, user_id) values (p_chain, p_index, uid);
  return public.adoration_chain_json(c, uid);
end;
$$;

-- Libérer mon créneau, tant qu'il n'est pas terminé. Possible aussi dans un groupe terminé. Renvoie la chaîne.
-- Codes : chaine_inconnue, creneau_invalide. Message : « Ce créneau est déjà passé ».
create or replace function public.release_slot(p_chain uuid, p_index integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  c public.adoration_chains;
begin
  select * into c from adoration_chains x where x.id = p_chain and x.cancelled_at is null for update;
  if not found or public.group_role(c.group_id, uid) is null then
    raise exception 'chaine_inconnue';
  end if;
  if p_index is null or p_index < 0 or p_index >= public.adoration_slot_count(c) then
    raise exception 'creneau_invalide';
  end if;
  if public.adoration_slot_end(c, p_index) <= now() then
    raise exception 'Ce créneau est déjà passé';
  end if;
  delete from adoration_slots s where s.chain_id = p_chain and s.slot_index = p_index and s.user_id = uid;
  return public.adoration_chain_json(c, uid);
end;
$$;

-- Modération : retirer la réservation d'un autre membre (propriétaire ou modérateur ; un modérateur ne retire pas celle du
-- propriétaire). Renvoie la chaîne. Codes : chaine_inconnue, creneau_invalide, interdit. Messages : « Ce groupe est terminé »,
-- « Ce créneau est déjà passé », « Cette personne n’a pas réservé ce créneau ».
create or replace function public.remove_slot_reservation(p_chain uuid, p_index integer, p_handle text)
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
  if p_index is null or p_index < 0 or p_index >= public.adoration_slot_count(c) then
    raise exception 'creneau_invalide';
  end if;
  if public.adoration_slot_end(c, p_index) <= now() then
    raise exception 'Ce créneau est déjà passé';
  end if;
  select p.id into target from profiles p where p.handle = lower(btrim(coalesce(p_handle, '')));
  if target is null or not exists (
    select 1 from adoration_slots s where s.chain_id = p_chain and s.slot_index = p_index and s.user_id = target
  ) then
    raise exception 'Cette personne n’a pas réservé ce créneau';
  end if;
  target_role := public.group_role(c.group_id, target);
  if target <> uid and r = 'moderator' and target_role = 'owner' then
    raise exception 'interdit';
  end if;
  delete from adoration_slots s where s.chain_id = p_chain and s.slot_index = p_index and s.user_id = target;
  return public.adoration_chain_json(c, uid);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Droits : aides internes fermées, fonctions de l'app ouvertes aux comptes connectés seulement.
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function public.adoration_slot_count(public.adoration_chains) from public, anon, authenticated;
revoke all on function public.adoration_slot_start(public.adoration_chains, integer) from public, anon, authenticated;
revoke all on function public.adoration_slot_end(public.adoration_chains, integer) from public, anon, authenticated;
revoke all on function public.check_adoration_fields(text, text, text, timestamptz, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function public.adoration_chain_json(public.adoration_chains, uuid) from public, anon, authenticated;
revoke all on function public.group_members_adoration_cleanup() from public, anon, authenticated;

revoke all on function public.create_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function public.update_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function public.cancel_adoration_chain(uuid) from public, anon, authenticated;
revoke all on function public.list_adoration_chains(uuid) from public, anon, authenticated;
revoke all on function public.get_adoration_chain(uuid) from public, anon, authenticated;
revoke all on function public.my_adoration_slots() from public, anon, authenticated;
revoke all on function public.reserve_slot(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_slot(uuid, integer) from public, anon, authenticated;
revoke all on function public.remove_slot_reservation(uuid, integer, text) from public, anon, authenticated;

grant execute on function public.create_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text) to authenticated;
grant execute on function public.update_adoration_chain(uuid, text, text, text, timestamptz, timestamptz, integer, text) to authenticated;
grant execute on function public.cancel_adoration_chain(uuid) to authenticated;
grant execute on function public.list_adoration_chains(uuid) to authenticated;
grant execute on function public.get_adoration_chain(uuid) to authenticated;
grant execute on function public.my_adoration_slots() to authenticated;
grant execute on function public.reserve_slot(uuid, integer) to authenticated;
grant execute on function public.release_slot(uuid, integer) to authenticated;
grant execute on function public.remove_slot_reservation(uuid, integer, text) to authenticated;
