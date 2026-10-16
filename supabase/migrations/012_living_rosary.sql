-- Rosaire vivant de groupe.
--
-- Un groupe (non terminé) peut avoir UN Rosaire vivant actif, lancé par un propriétaire ou un modérateur. Il garde le fuseau
-- IANA de son créateur (validé contre pg_timezone_names, comme 009 et 011) et son mois de départ (le 1er du mois en cours dans
-- ce fuseau, au lancement). Annulable par un propriétaire ou un modérateur ; on peut alors en lancer un autre.
--
-- 20 mystères, dans l'ordre de l'app (src/data/prayers.ts, MYSTERIES) : joyeux 1 à 5 (index 0 à 4), lumineux 6 à 10 (5 à 9),
-- douloureux 11 à 15 (10 à 14), glorieux 16 à 20 (15 à 19). Le Rosaire vivant a des « équipes » de 20 places : l'équipe 1 se
-- remplit d'abord ; quand elle est pleine, une 2e équipe s'ouvre, etc. (5 équipes au plus : 100 participants).
--
-- Rotation mensuelle SANS tâche planifiée : chaque participant garde une place de base `slot` (0 à 19) dans son équipe ; son
-- mystère du mois est (slot + mois écoulés depuis le mois de départ) mod 20. Les mois écoulés se comptent dans le fuseau du
-- Rosaire : le mystère change le 1er du mois à 0 h dans ce fuseau. Le même calcul est fait sur le téléphone, en pur
-- (src/living-rosary.ts, testé) : le serveur reste la référence pour accepter une action.
--
-- Rejoindre : un membre du groupe « prend un mystère ». join_rosary(id, null) attribue la première place libre (équipe la
-- plus basse, puis le plus petit mystère libre CE MOIS-CI) ; join_rosary(id, n) vise un mystère précis, libre ce mois-ci dans
-- l'équipe la plus basse où il l'est. Le Rosaire est verrouillé (for update) pendant l'attribution : pas de doublon sous
-- concurrence (unique (rosary_id, team, slot) en dernier garde-fou). Quitter libère la place.
--
-- Chaque jour (jour local du fuseau du Rosaire, calculé par le SERVEUR : l'horloge du téléphone n'est jamais crue) le
-- participant coche « J'ai prié ma dizaine ». Décochable le jour même. PAS de rattrapage : c'est un engagement quotidien,
-- on ne coche jamais un autre jour que le jour courant.
--
-- Qui voit quoi : seuls les membres du groupe voient le Rosaire. Les membres d'un groupe voient déjà leurs pseudos
-- (list_members, 008) : chaque mystère porte donc le pseudo de son participant, sauf si l'un des deux a bloqué l'autre
-- (is_blocked, 007) : la place apparaît alors prise, sans pseudo (« hidden »), l'app écrit « Un membre ».
-- Les rappels sont LOCAUX (sur le téléphone) : le serveur ne pousse rien. L'heure du rappel est gardée avec la participation
-- (rosary_members.remind_time) pour suivre la personne sur ses autres appareils. Un seul Rosaire vivant rappelé à la fois
-- (budget de notifications d'iOS, cf. src/reminder.ts).
--
-- Les tables ne sont pas lisibles directement (RLS sans politique, droits retirés) : tout passe par les fonctions ci-dessous.
--
-- delete_my_account (004) : supprimer auth.users emporte rosary_members et rosary_decades de la personne par on delete
--   cascade ; group_rosaries.created_by passe à null (le Rosaire reste au groupe). daily_posts est vidé par
--   delete_my_account (le nouveau type 'rosary' compris). Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme n'est membre de rien et ne prie rien.
-- Départ d'un membre (quitter, exclusion) : le trigger group_members_rosary_cleanup (ci-dessous) retire sa participation
--   (place libérée, dizaines cochées, rappel) ; group_members_after_delete (008) et group_members_novenas_cleanup (011) ne
--   sont pas modifiés.

create table public.group_rosaries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  start_month date not null,
  timezone text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint group_rosaries_start_month check (extract(day from start_month) = 1)
);

-- Un seul Rosaire vivant actif par groupe.
create unique index group_rosaries_one_active on public.group_rosaries (group_id) where cancelled_at is null;

create table public.rosary_members (
  rosary_id uuid not null references public.group_rosaries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  team smallint not null,
  slot smallint not null,
  remind_time time,
  joined_at timestamptz not null default now(),
  primary key (rosary_id, user_id),
  constraint rosary_members_team check (team between 1 and 5),
  constraint rosary_members_slot check (slot between 0 and 19),
  constraint rosary_members_place unique (rosary_id, team, slot)
);

create index rosary_members_user_idx on public.rosary_members (user_id);

create table public.rosary_decades (
  rosary_id uuid not null references public.group_rosaries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (rosary_id, user_id, day)
);

create index rosary_decades_user_idx on public.rosary_decades (user_id);

alter table public.group_rosaries enable row level security;
alter table public.rosary_members enable row level security;
alter table public.rosary_decades enable row level security;

revoke all on table public.group_rosaries from anon, authenticated;
revoke all on table public.rosary_members from anon, authenticated;
revoke all on table public.rosary_decades from anon, authenticated;

-- Lancer un Rosaire vivant compte dans une limite quotidienne, comme les groupes, les intentions et les neuvaines.
-- On remplace la contrainte de 011 en gardant tous ses types et en ajoutant 'rosary'.
alter table public.daily_posts drop constraint if exists daily_posts_kind_check;
alter table public.daily_posts
  add constraint daily_posts_kind_check
  check (kind in ('echo', 'intention', 'follow', 'group', 'group_intention', 'code_try', 'novena', 'rosary'));

-- ---------------------------------------------------------------------------------------------------------------
-- Aides internes : pas de droit d'exécution pour les clients.
-- ---------------------------------------------------------------------------------------------------------------

-- Mois écoulés depuis le mois de départ, comptés dans le fuseau du Rosaire (0 le mois du lancement). Jamais négatif.
create or replace function public.rosary_months(r public.group_rosaries, p_now timestamptz)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(
    0,
    (extract(year from (p_now at time zone r.timezone))::integer * 12 + extract(month from (p_now at time zone r.timezone))::integer)
    - (extract(year from r.start_month)::integer * 12 + extract(month from r.start_month)::integer)
  );
$$;

-- Le mystère (0 à 19) d'une place de base après `p_months` mois : (slot + mois) mod 20.
create or replace function public.rosary_mystery(p_slot integer, p_months integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select (((p_slot + p_months) % 20) + 20) % 20;
$$;

-- Le jour local du Rosaire à l'instant donné : il change à minuit dans son fuseau.
create or replace function public.rosary_today(r public.group_rosaries, p_now timestamptz)
returns date
language sql
stable
set search_path = public
as $$
  select (p_now at time zone r.timezone)::date;
$$;

-- Le Rosaire sous forme de jsonb, vu par p_uid (déjà vérifié membre du groupe).
--   me : null si je ne participe pas, sinon { team, slot, mystery (ce mois-ci), next_mystery (le mois prochain), prayed_today }.
--   open_team : l'équipe où l'on prend place (la plus basse qui a une place libre), null si les 5 équipes sont pleines.
--   teams : les équipes ouvertes (1 à open_team au moins) ; pour chacune, les 20 mystères de CE mois-ci :
--     { mystery, taken, mine, prayed (aujourd'hui), handle (null si libre, moi ou bloqué), hidden (bloqué) }.
create or replace function public.rosary_json(r public.group_rosaries, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  grp public.groups;
  months integer := public.rosary_months(r, now());
  today date := public.rosary_today(r, now());
  mine public.rosary_members;
  me jsonb := 'null'::jsonb;
  tmax integer;
  open_team integer;
  nteams integer;
  teams jsonb;
  remind time;
  myrole text := public.group_role(r.group_id, p_uid);
begin
  select * into grp from groups x where x.id = r.group_id;
  select * into mine from rosary_members x where x.rosary_id = r.id and x.user_id = p_uid;
  if found then
    me := jsonb_build_object(
      'team', mine.team,
      'slot', mine.slot,
      'mystery', public.rosary_mystery(mine.slot, months),
      'next_mystery', public.rosary_mystery(mine.slot, months + 1),
      'prayed_today', exists (
        select 1 from rosary_decades d where d.rosary_id = r.id and d.user_id = p_uid and d.day = today
      )
    );
    remind := mine.remind_time;
  end if;
  select coalesce(max(x.team), 0)::integer into tmax from rosary_members x where x.rosary_id = r.id;
  select s.team into open_team
  from generate_series(1, 5) as s(team)
  where (select count(*) from rosary_members x where x.rosary_id = r.id and x.team = s.team) < 20
  order by s.team
  limit 1;
  nteams := case when open_team is null then 5 else greatest(tmax, open_team, 1) end;
  with mem as (
    select
      x.team,
      x.user_id,
      public.rosary_mystery(x.slot, months) as mystery,
      p.handle,
      exists (
        select 1 from rosary_decades d where d.rosary_id = r.id and d.user_id = x.user_id and d.day = today
      ) as prayed
    from rosary_members x
    join profiles p on p.id = x.user_id
    where x.rosary_id = r.id
  )
  select jsonb_agg(
    jsonb_build_object(
      'team', t.team,
      'taken_count', (select count(*)::integer from mem y where y.team = t.team),
      'prayed_count', (select count(*)::integer from mem y where y.team = t.team and y.prayed),
      'mysteries', (
        select jsonb_agg(
          jsonb_build_object(
            'mystery', k.mystery,
            'taken', y.user_id is not null,
            'mine', y.user_id is not null and y.user_id = p_uid,
            'prayed', coalesce(y.prayed, false),
            'handle', case
              when y.user_id is null or y.user_id = p_uid or public.is_blocked(p_uid, y.user_id) then null
              else y.handle
            end,
            'hidden', y.user_id is not null and y.user_id <> p_uid and public.is_blocked(p_uid, y.user_id)
          )
          order by k.mystery
        )
        from generate_series(0, 19) as k(mystery)
        left join mem y on y.team = t.team and y.mystery = k.mystery
      )
    )
    order by t.team
  )
  into teams
  from generate_series(1, nteams) as t(team);
  return jsonb_build_object(
    'id', r.id,
    'group_id', r.group_id,
    'group_name', grp.name,
    'group_ended', public.group_ended(grp.ends_at),
    'can_manage', myrole in ('owner', 'moderator'),
    'start_month', to_char(r.start_month, 'YYYY-MM-DD'),
    'timezone', r.timezone,
    'today', to_char(today, 'YYYY-MM-DD'),
    'months_elapsed', months,
    'reminder_time', to_char(remind, 'HH24:MI'),
    'me', me,
    'open_team', open_team,
    'participant_count', (select count(*)::integer from rosary_members x where x.rosary_id = r.id),
    'teams', coalesce(teams, '[]'::jsonb)
  );
end;
$$;

-- Départ d'un membre du groupe : sa participation au Rosaire vivant de ce groupe disparaît (place libérée, dizaines cochées,
-- rappel ; les rappels locaux s'arrêtent à la prochaine synchronisation). Trigger dédié : les triggers de 008 et 011
-- restent tels quels.
create or replace function public.group_members_rosary_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from rosary_members m
  using group_rosaries r
  where m.rosary_id = r.id and r.group_id = old.group_id and m.user_id = old.user_id;
  delete from rosary_decades d
  using group_rosaries r
  where d.rosary_id = r.id and r.group_id = old.group_id and d.user_id = old.user_id;
  return old;
end;
$$;

create trigger group_members_rosary_cleanup
  after delete on public.group_members
  for each row execute function public.group_members_rosary_cleanup();

-- ---------------------------------------------------------------------------------------------------------------
-- Lancer et annuler (propriétaire ou modérateur)
-- ---------------------------------------------------------------------------------------------------------------

-- Codes : groupe_inconnu (pas membre), interdit, fuseau_invalide.
-- Messages français : « Ce groupe est terminé », « Ce groupe a déjà un Rosaire vivant »,
-- « Trop de Rosaires vivants lancés aujourd’hui » (3 par jour et par personne).
-- Le mois de départ est le mois en cours dans le fuseau donné.
create or replace function public.start_rosary(p_group uuid, p_timezone text)
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
  -- Verrou sur le groupe : un seul Rosaire actif, même sous concurrence.
  select g.ends_at into ends from groups g where g.id = p_group for update;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names z where z.name = p_timezone) then
    raise exception 'fuseau_invalide';
  end if;
  if exists (select 1 from group_rosaries x where x.group_id = p_group and x.cancelled_at is null) then
    raise exception 'Ce groupe a déjà un Rosaire vivant';
  end if;
  if (
    select count(*) from daily_posts d
    where d.user_id = uid and d.kind = 'rosary' and d.created_at > now() - interval '1 day'
  ) >= 3 then
    raise exception 'Trop de Rosaires vivants lancés aujourd’hui';
  end if;
  insert into group_rosaries (group_id, start_month, timezone, created_by)
  values (p_group, date_trunc('month', now() at time zone p_timezone)::date, p_timezone, uid)
  returning id into new_id;
  insert into daily_posts (user_id, kind) values (uid, 'rosary');
  return new_id;
end;
$$;

-- Propriétaire ou modérateur, aussi dans un groupe terminé. Code : rosaire_inconnu. Les participations sont conservées
-- mais ne sont plus lues : on peut lancer un autre Rosaire vivant.
create or replace function public.cancel_rosary(p_id uuid)
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
  select x.group_id into gid from group_rosaries x where x.id = p_id and x.cancelled_at is null;
  r := case when gid is null then null else public.group_role(gid, uid) end;
  if r is null then
    raise exception 'rosaire_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  update group_rosaries set cancelled_at = now() where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Lecture (tout membre)
-- ---------------------------------------------------------------------------------------------------------------

-- Le Rosaire vivant actif d'un groupe (objet jsonb, voir rosary_json), ou null s'il n'y en a pas. Code : groupe_inconnu.
create or replace function public.get_group_rosary(p_group uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r public.group_rosaries;
begin
  if public.group_role(p_group, uid) is null then
    raise exception 'groupe_inconnu';
  end if;
  select * into r from group_rosaries x where x.group_id = p_group and x.cancelled_at is null;
  if not found then
    return 'null'::jsonb;
  end if;
  return public.rosary_json(r, uid);
end;
$$;

-- Un Rosaire vivant par son identifiant (ouverture depuis un rappel). Code : rosaire_inconnu (inconnu, annulé, ou je ne suis
-- pas membre du groupe).
create or replace function public.get_rosary(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r public.group_rosaries;
begin
  select * into r from group_rosaries x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(r.group_id, uid) is null then
    raise exception 'rosaire_inconnu';
  end if;
  return public.rosary_json(r, uid);
end;
$$;

-- Mes Rosaires vivants (ceux où je participe), dans les groupes où je suis encore membre et qui ne sont pas terminés : de
-- quoi programmer le rappel sur le téléphone et montrer l'accueil. Le téléphone calcule le mystère du mois avec la place de
-- base, le mois de départ et le fuseau. Tableau jsonb.
create or replace function public.my_rosaries()
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
        'id', r.id,
        'group_id', r.group_id,
        'group_name', gr.name,
        'start_month', to_char(r.start_month, 'YYYY-MM-DD'),
        'timezone', r.timezone,
        'team', m.team,
        'slot', m.slot,
        'today', to_char(public.rosary_today(r, now()), 'YYYY-MM-DD'),
        'prayed_today', exists (
          select 1 from rosary_decades d
          where d.rosary_id = r.id and d.user_id = uid and d.day = public.rosary_today(r, now())
        ),
        'reminder_time', to_char(m.remind_time, 'HH24:MI')
      )
      order by r.created_at, r.id
    )
    from group_rosaries r
    join groups gr on gr.id = r.group_id
    join group_members gm on gm.group_id = r.group_id and gm.user_id = uid
    join rosary_members m on m.rosary_id = r.id and m.user_id = uid
    where r.cancelled_at is null
      and not public.group_ended(gr.ends_at)
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Participation (tout membre)
-- ---------------------------------------------------------------------------------------------------------------

-- « Prendre un mystère ». p_mystery null : la première place libre (équipe la plus basse, puis le plus petit mystère libre ce
-- mois-ci) ; sinon le mystère 0 à 19 voulu, s'il est libre ce mois-ci. Renvoie l'état du Rosaire (voir rosary_json).
-- Codes : rosaire_inconnu, mystere_invalide. Messages : « Ce groupe est terminé », « Tu participes déjà à ce Rosaire vivant »,
-- « Ce Rosaire vivant est complet », « Ce mystère est déjà pris ».
create or replace function public.join_rosary(p_id uuid, p_mystery integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r public.group_rosaries;
  ends timestamptz;
  months integer;
  taken integer;
  slot_try integer;
  chosen_team integer;
  chosen_slot integer;
  team_try integer;
  k integer;
begin
  select * into r from group_rosaries x where x.id = p_id and x.cancelled_at is null for update;
  if not found or public.group_role(r.group_id, uid) is null then
    raise exception 'rosaire_inconnu';
  end if;
  select gr.ends_at into ends from groups gr where gr.id = r.group_id;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  if p_mystery is not null and (p_mystery < 0 or p_mystery > 19) then
    raise exception 'mystere_invalide';
  end if;
  if exists (select 1 from rosary_members m where m.rosary_id = p_id and m.user_id = uid) then
    raise exception 'Tu participes déjà à ce Rosaire vivant';
  end if;
  if (select count(*) from rosary_members m where m.rosary_id = p_id) >= 100 then
    raise exception 'Ce Rosaire vivant est complet';
  end if;
  months := public.rosary_months(r, now());
  for team_try in 1..5 loop
    select count(*)::integer into taken from rosary_members m where m.rosary_id = p_id and m.team = team_try;
    continue when taken >= 20;
    if p_mystery is null then
      for k in 0..19 loop
        slot_try := (((k - months) % 20) + 20) % 20;
        if not exists (
          select 1 from rosary_members m where m.rosary_id = p_id and m.team = team_try and m.slot = slot_try
        ) then
          chosen_team := team_try;
          chosen_slot := slot_try;
          exit;
        end if;
      end loop;
    else
      slot_try := (((p_mystery - months) % 20) + 20) % 20;
      if not exists (
        select 1 from rosary_members m where m.rosary_id = p_id and m.team = team_try and m.slot = slot_try
      ) then
        chosen_team := team_try;
        chosen_slot := slot_try;
      end if;
    end if;
    exit when chosen_team is not null;
  end loop;
  if chosen_team is null then
    raise exception 'Ce mystère est déjà pris';
  end if;
  insert into rosary_members (rosary_id, user_id, team, slot) values (p_id, uid, chosen_team, chosen_slot);
  return public.rosary_json(r, uid);
end;
$$;

-- Quitter le Rosaire vivant : la place est libérée, mes dizaines cochées et mon rappel disparaissent. Possible aussi dans un
-- groupe terminé. Code : rosaire_inconnu.
create or replace function public.leave_rosary(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r public.group_rosaries;
begin
  select * into r from group_rosaries x where x.id = p_id and x.cancelled_at is null for update;
  if not found or public.group_role(r.group_id, uid) is null then
    raise exception 'rosaire_inconnu';
  end if;
  delete from rosary_members m where m.rosary_id = p_id and m.user_id = uid;
  delete from rosary_decades d where d.rosary_id = p_id and d.user_id = uid;
end;
$$;

-- « J'ai prié ma dizaine » (p_on vrai) ou décocher, pour le jour courant du Rosaire, calculé par le serveur : aucun autre jour
-- n'est possible (pas de rattrapage). Cocher est refusé dans un groupe terminé.
-- Codes : rosaire_inconnu, pas_participant.
create or replace function public.set_decade_prayed(p_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r public.group_rosaries;
  ends timestamptz;
  today date;
begin
  select * into r from group_rosaries x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(r.group_id, uid) is null then
    raise exception 'rosaire_inconnu';
  end if;
  if not exists (select 1 from rosary_members m where m.rosary_id = p_id and m.user_id = uid) then
    raise exception 'pas_participant';
  end if;
  today := public.rosary_today(r, now());
  if p_on is true then
    select gr.ends_at into ends from groups gr where gr.id = r.group_id;
    if public.group_ended(ends) then
      raise exception 'Ce groupe est terminé';
    end if;
    insert into rosary_decades (rosary_id, user_id, day) values (p_id, uid, today) on conflict do nothing;
  else
    delete from rosary_decades d where d.rosary_id = p_id and d.user_id = uid and d.day = today;
  end if;
end;
$$;

-- Règle (p_time) ou retire (null) mon rappel quotidien pour ce Rosaire vivant. L'heure est celle du mur de mon téléphone ; le
-- serveur la garde pour mes autres appareils. Un seul Rosaire vivant rappelé à la fois.
-- Codes : rosaire_inconnu, pas_participant. Messages : « Ce groupe est terminé », « Tu as déjà un Rosaire vivant rappelé ».
create or replace function public.set_rosary_reminder(p_id uuid, p_time time)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r public.group_rosaries;
  ends timestamptz;
begin
  select * into r from group_rosaries x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(r.group_id, uid) is null then
    raise exception 'rosaire_inconnu';
  end if;
  if not exists (select 1 from rosary_members m where m.rosary_id = p_id and m.user_id = uid) then
    raise exception 'pas_participant';
  end if;
  if p_time is null then
    update rosary_members m set remind_time = null where m.rosary_id = p_id and m.user_id = uid;
    return;
  end if;
  select gr.ends_at into ends from groups gr where gr.id = r.group_id;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  if exists (
    select 1
    from rosary_members m
    join group_rosaries x on x.id = m.rosary_id
    join group_members gm on gm.group_id = x.group_id and gm.user_id = uid
    join groups gx on gx.id = x.group_id
    where m.user_id = uid and m.rosary_id <> p_id and m.remind_time is not null and x.cancelled_at is null
      and not public.group_ended(gx.ends_at)
  ) then
    raise exception 'Tu as déjà un Rosaire vivant rappelé';
  end if;
  update rosary_members m
  set remind_time = make_time(extract(hour from p_time)::integer, extract(minute from p_time)::integer, 0)
  where m.rosary_id = p_id and m.user_id = uid;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Droits : aides internes fermées, fonctions de l'app ouvertes aux comptes connectés seulement.
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function public.rosary_months(public.group_rosaries, timestamptz) from public, anon, authenticated;
revoke all on function public.rosary_mystery(integer, integer) from public, anon, authenticated;
revoke all on function public.rosary_today(public.group_rosaries, timestamptz) from public, anon, authenticated;
revoke all on function public.rosary_json(public.group_rosaries, uuid) from public, anon, authenticated;
revoke all on function public.group_members_rosary_cleanup() from public, anon, authenticated;

revoke all on function public.start_rosary(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_rosary(uuid) from public, anon, authenticated;
revoke all on function public.get_group_rosary(uuid) from public, anon, authenticated;
revoke all on function public.get_rosary(uuid) from public, anon, authenticated;
revoke all on function public.my_rosaries() from public, anon, authenticated;
revoke all on function public.join_rosary(uuid, integer) from public, anon, authenticated;
revoke all on function public.leave_rosary(uuid) from public, anon, authenticated;
revoke all on function public.set_decade_prayed(uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_rosary_reminder(uuid, time) from public, anon, authenticated;

grant execute on function public.start_rosary(uuid, text) to authenticated;
grant execute on function public.cancel_rosary(uuid) to authenticated;
grant execute on function public.get_group_rosary(uuid) to authenticated;
grant execute on function public.get_rosary(uuid) to authenticated;
grant execute on function public.my_rosaries() to authenticated;
grant execute on function public.join_rosary(uuid, integer) to authenticated;
grant execute on function public.leave_rosary(uuid) to authenticated;
grant execute on function public.set_decade_prayed(uuid, boolean) to authenticated;
grant execute on function public.set_rosary_reminder(uuid, time) to authenticated;
