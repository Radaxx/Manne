-- Neuvaines collectives de groupe.
--
-- Une neuvaine appartient à un groupe : un modèle (esprit-saint, saint-joseph, sacre-coeur, notre-dame, ou
-- personnalisee), un titre, une intention commune (1 à 280 caractères, visible des membres du groupe), une date de
-- début (un jour du calendrier) et le fuseau IANA de son créateur (validé contre pg_timezone_names, comme les rendez-vous
-- de 009). Le contenu des modèles (passages, méditations, prières) est dans l'app ; le serveur ne garde que ce qui
-- décide des jours : jour N = jour local de début + N - 1, dans ce fuseau. Le modèle `personnalisee` garde en plus la
-- prière du créateur (1 à 2000 caractères, récitée chaque jour) et, facultatif, le nom d'une suite de passages
-- proposée par l'app (passage_set : « psaumes » ou « evangile »).
--
-- Jour courant : novena_current_day(n, now) vaut 0 si la neuvaine n'a pas commencé, 1 à 9, ou 10 une fois le jour 9 passé.
-- C'est TOUJOURS le serveur qui le calcule (l'horloge du téléphone n'est jamais crue pour accepter un jour).
--
-- Qui fait quoi :
--   propriétaire ou modérateur : lancer (3 neuvaines en cours au plus par groupe, 5 lancements par jour et par personne,
--     pas de lancement dans un groupe terminé, et dans un groupe éphémère la neuvaine doit finir avant ends_at) ;
--     annuler ;
--   tout membre : voir, marquer « J'ai prié le jour N » pour le jour en cours ou un jour PASSÉ (rattrapage), jamais un jour
--     futur ; décocher ; régler un rappel quotidien (3 neuvaines rappelées au plus par personne).
-- Seuls les membres voient les neuvaines et leur intention. Les priants sont COMPTÉS, jamais listés : aucun pseudo n'est
-- exposé. Les compteurs sont anonymes : on ne retire donc pas les personnes bloquées (rien ne les désigne), on compte
-- seulement les membres actuels du groupe.
-- Les rappels sont LOCAUX (sur le téléphone) : le serveur ne pousse rien. L'heure du rappel est gardée avec l'inscription
-- (novena_reminders) pour que le rappel suive la personne sur ses autres appareils.
--
-- Les tables ne sont pas lisibles directement (RLS sans politique, droits retirés) : tout passe par les fonctions ci-dessous.
--
-- delete_my_account (004) : supprimer auth.users emporte novena_days_prayed et novena_reminders de la personne par
--   on delete cascade ; group_novenas.created_by passe à null (la neuvaine reste au groupe). daily_posts est vidé par
--   delete_my_account (le nouveau type 'novena' compris). Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme n'est membre de rien et ne prie rien.
-- Départ d'un membre (quitter, exclusion) : le trigger group_members_novenas_cleanup (ci-dessous) retire ses rappels ;
--   group_members_after_delete (008) n'est pas modifié. Ses jours priés restent mais ne sont plus comptés.

create table public.group_novenas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  model text not null,
  title text not null,
  intention text not null,
  custom_prayer text,
  passage_set text,
  start_date date not null,
  timezone text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint group_novenas_model check (model in ('esprit-saint', 'saint-joseph', 'sacre-coeur', 'notre-dame', 'personnalisee')),
  constraint group_novenas_title_len check (char_length(btrim(title)) between 3 and 60),
  constraint group_novenas_intention_len check (char_length(btrim(intention)) between 1 and 280),
  constraint group_novenas_custom check (
    (model = 'personnalisee' and custom_prayer is not null and char_length(btrim(custom_prayer)) between 1 and 2000)
    or (model <> 'personnalisee' and custom_prayer is null and passage_set is null)
  ),
  constraint group_novenas_passage_set check (passage_set is null or passage_set in ('psaumes', 'evangile'))
);

create index group_novenas_group_idx on public.group_novenas (group_id) where cancelled_at is null;

create table public.novena_days_prayed (
  novena_id uuid not null references public.group_novenas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day smallint not null,
  created_at timestamptz not null default now(),
  primary key (novena_id, user_id, day),
  constraint novena_days_prayed_day check (day between 1 and 9)
);

create index novena_days_prayed_user_idx on public.novena_days_prayed (user_id);

create table public.novena_reminders (
  novena_id uuid not null references public.group_novenas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  remind_time time not null,
  primary key (novena_id, user_id)
);

create index novena_reminders_user_idx on public.novena_reminders (user_id);

alter table public.group_novenas enable row level security;
alter table public.novena_days_prayed enable row level security;
alter table public.novena_reminders enable row level security;

revoke all on table public.group_novenas from anon, authenticated;
revoke all on table public.novena_days_prayed from anon, authenticated;
revoke all on table public.novena_reminders from anon, authenticated;

-- Lancer une neuvaine compte dans une limite quotidienne, comme les groupes, les intentions et les échos.
-- On remplace la contrainte de 008 en gardant tous ses types et en ajoutant 'novena'.
alter table public.daily_posts drop constraint if exists daily_posts_kind_check;
alter table public.daily_posts
  add constraint daily_posts_kind_check
  check (kind in ('echo', 'intention', 'follow', 'group', 'group_intention', 'code_try', 'novena'));

-- ---------------------------------------------------------------------------------------------------------------
-- Aides internes : pas de droit d'exécution pour les clients.
-- ---------------------------------------------------------------------------------------------------------------

-- 0 : pas commencée ; 1 à 9 : jour en cours ; 10 : terminée. Le jour change à minuit dans le fuseau de la neuvaine.
create or replace function public.novena_current_day(n public.group_novenas, p_now timestamptz)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when (p_now at time zone n.timezone)::date < n.start_date then 0
    when (p_now at time zone n.timezone)::date >= n.start_date + 9 then 10
    else (p_now at time zone n.timezone)::date - n.start_date + 1
  end;
$$;

-- L'instant où le jour 9 est fini (minuit local qui suit), dans le fuseau de la neuvaine.
create or replace function public.novena_end(n public.group_novenas)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select ((n.start_date + 9)::timestamp) at time zone n.timezone;
$$;

-- La neuvaine sous forme de jsonb, vue par p_uid (déjà vérifié membre) : compteurs anonymes par jour, mes jours priés,
-- mon rappel. day_counts : 9 nombres (jours 1 à 9) de membres actuels qui ont prié ce jour-là.
-- finisher_count : membres actuels qui ont prié les 9 jours.
create or replace function public.novena_json(n public.group_novenas, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.groups;
  counts integer[];
  mine integer[];
  finishers integer;
  remind time;
  myrole text := public.group_role(n.group_id, p_uid);
begin
  select * into g from groups x where x.id = n.group_id;
  select array_agg(coalesce(c.cnt, 0) order by d.day) into counts
  from generate_series(1, 9) as d(day)
  left join (
    select p.day::integer as day, count(*)::integer as cnt
    from novena_days_prayed p
    join group_members m on m.group_id = n.group_id and m.user_id = p.user_id
    where p.novena_id = n.id
    group by p.day
  ) c on c.day = d.day;
  select coalesce(array_agg(p.day::integer order by p.day), '{}') into mine
  from novena_days_prayed p where p.novena_id = n.id and p.user_id = p_uid;
  select count(*)::integer into finishers from (
    select p.user_id
    from novena_days_prayed p
    join group_members m on m.group_id = n.group_id and m.user_id = p.user_id
    where p.novena_id = n.id
    group by p.user_id
    having count(*) = 9
  ) f;
  select r.remind_time into remind from novena_reminders r where r.novena_id = n.id and r.user_id = p_uid;
  return jsonb_build_object(
    'id', n.id,
    'group_id', n.group_id,
    'group_name', g.name,
    'group_ended', public.group_ended(g.ends_at),
    'can_manage', myrole in ('owner', 'moderator'),
    'model', n.model,
    'title', n.title,
    'intention', n.intention,
    'custom_prayer', n.custom_prayer,
    'passage_set', n.passage_set,
    'start_date', to_char(n.start_date, 'YYYY-MM-DD'),
    'timezone', n.timezone,
    'current_day', public.novena_current_day(n, now()),
    'day_counts', to_jsonb(counts),
    'my_days', to_jsonb(mine),
    'reminder_time', to_char(remind, 'HH24:MI'),
    'finisher_count', finishers,
    'member_count', (select count(*)::integer from group_members m where m.group_id = n.group_id)
  );
end;
$$;

-- Départ d'un membre : ses rappels de neuvaine de ce groupe disparaissent (les rappels locaux s'arrêtent à la prochaine
-- synchronisation). Trigger dédié : group_members_after_delete (008) reste tel quel.
create or replace function public.group_members_novenas_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from novena_reminders r
  using group_novenas n
  where r.novena_id = n.id and n.group_id = old.group_id and r.user_id = old.user_id;
  return old;
end;
$$;

create trigger group_members_novenas_cleanup
  after delete on public.group_members
  for each row execute function public.group_members_novenas_cleanup();

-- ---------------------------------------------------------------------------------------------------------------
-- Lancer et annuler (propriétaire ou modérateur)
-- ---------------------------------------------------------------------------------------------------------------

-- Codes : groupe_inconnu (pas membre), interdit, modele_invalide, titre_invalide, intention_invalide,
-- priere_perso_invalide, passages_invalides, fuseau_invalide, debut_invalide.
-- Messages français : « Ce groupe est terminé », « Ce groupe a déjà 3 neuvaines en cours »,
-- « Ce groupe se termine avant la fin de la neuvaine », « Trop de neuvaines lancées aujourd’hui ».
-- Début : de aujourd'hui (jour local du fuseau donné) à 30 jours plus tard.
create or replace function public.start_novena(
  p_group uuid,
  p_model text,
  p_title text,
  p_intention text,
  p_custom_prayer text,
  p_passage_set text,
  p_start_date date,
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
  today date;
  custom boolean := p_model = 'personnalisee';
  new_id uuid;
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  -- Verrou sur le groupe : la limite de 3 tient sous concurrence.
  select g.ends_at into ends from groups g where g.id = p_group for update;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  if p_model is null or p_model not in ('esprit-saint', 'saint-joseph', 'sacre-coeur', 'notre-dame', 'personnalisee') then
    raise exception 'modele_invalide';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 3 or char_length(btrim(p_title)) > 60 then
    raise exception 'titre_invalide';
  end if;
  if char_length(btrim(coalesce(p_intention, ''))) < 1 or char_length(btrim(p_intention)) > 280 then
    raise exception 'intention_invalide';
  end if;
  if custom and (char_length(btrim(coalesce(p_custom_prayer, ''))) < 1 or char_length(btrim(p_custom_prayer)) > 2000) then
    raise exception 'priere_perso_invalide';
  end if;
  if p_passage_set is not null and (not custom or p_passage_set not in ('psaumes', 'evangile')) then
    raise exception 'passages_invalides';
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names z where z.name = p_timezone) then
    raise exception 'fuseau_invalide';
  end if;
  today := (now() at time zone p_timezone)::date;
  if p_start_date is null or p_start_date < today or p_start_date > today + 30 then
    raise exception 'debut_invalide';
  end if;
  -- Dans un groupe éphémère, le jour 9 doit être fini avant la fin du groupe.
  if ends is not null and ((p_start_date + 9)::timestamp) at time zone p_timezone > ends then
    raise exception 'Ce groupe se termine avant la fin de la neuvaine';
  end if;
  if (
    select count(*) from group_novenas x
    where x.group_id = p_group and x.cancelled_at is null and public.novena_end(x) > now()
  ) >= 3 then
    raise exception 'Ce groupe a déjà 3 neuvaines en cours';
  end if;
  if (
    select count(*) from daily_posts d
    where d.user_id = uid and d.kind = 'novena' and d.created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'Trop de neuvaines lancées aujourd’hui';
  end if;
  insert into group_novenas (group_id, model, title, intention, custom_prayer, passage_set, start_date, timezone, created_by)
  values (
    p_group,
    p_model,
    btrim(p_title),
    btrim(p_intention),
    case when custom then btrim(p_custom_prayer) end,
    case when custom then p_passage_set end,
    p_start_date,
    p_timezone,
    uid
  )
  returning id into new_id;
  insert into daily_posts (user_id, kind) values (uid, 'novena');
  return new_id;
end;
$$;

-- Propriétaire ou modérateur, aussi dans un groupe terminé et pour une neuvaine finie. Code : neuvaine_inconnue.
create or replace function public.cancel_novena(p_id uuid)
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
  select x.group_id into gid from group_novenas x where x.id = p_id and x.cancelled_at is null;
  r := case when gid is null then null else public.group_role(gid, uid) end;
  if r is null then
    raise exception 'neuvaine_inconnue';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  update group_novenas set cancelled_at = now() where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Lecture (tout membre)
-- ---------------------------------------------------------------------------------------------------------------

-- Les neuvaines du groupe : en cours, à venir, ou terminées depuis moins de 7 jours. Tableau jsonb (voir novena_json).
create or replace function public.list_novenas(p_group uuid)
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
    select jsonb_agg(public.novena_json(n, uid) order by n.start_date, n.created_at)
    from group_novenas n
    where n.group_id = p_group and n.cancelled_at is null and public.novena_end(n) + interval '7 days' > now()
  ), '[]'::jsonb);
end;
$$;

-- Une neuvaine (objet jsonb). Code : neuvaine_inconnue (inconnue, annulée, ou je ne suis pas membre du groupe).
create or replace function public.get_novena(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  n public.group_novenas;
begin
  select * into n from group_novenas x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(n.group_id, uid) is null then
    raise exception 'neuvaine_inconnue';
  end if;
  return public.novena_json(n, uid);
end;
$$;

-- Mes neuvaines à venir ou en cours, dans les groupes où je suis encore membre et qui ne sont pas terminés :
-- de quoi programmer les rappels sur le téléphone et montrer « Neuvaines en cours » sur l'accueil. Tableau jsonb.
create or replace function public.my_novenas()
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
        'id', n.id,
        'group_id', n.group_id,
        'group_name', gr.name,
        'title', n.title,
        'model', n.model,
        'start_date', to_char(n.start_date, 'YYYY-MM-DD'),
        'timezone', n.timezone,
        'current_day', public.novena_current_day(n, now()),
        'my_days', to_jsonb(coalesce((
          select array_agg(p.day::integer order by p.day) from novena_days_prayed p where p.novena_id = n.id and p.user_id = uid
        ), '{}'::integer[])),
        'reminder_time', (select to_char(rm.remind_time, 'HH24:MI') from novena_reminders rm where rm.novena_id = n.id and rm.user_id = uid)
      )
      order by n.start_date, n.created_at
    )
    from group_novenas n
    join groups gr on gr.id = n.group_id
    join group_members m on m.group_id = n.group_id and m.user_id = uid
    where n.cancelled_at is null
      and not public.group_ended(gr.ends_at)
      and public.novena_end(n) > now()
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Participation (tout membre)
-- ---------------------------------------------------------------------------------------------------------------

-- « J'ai prié le jour N » (p_on vrai) ou décocher. Le serveur calcule le jour courant : un jour futur est refusé, le jour
-- en cours et les jours passés (rattrapage) sont acceptés. Cocher est refusé dans un groupe terminé.
-- Codes : neuvaine_inconnue, jour_neuvaine_invalide. Message : « Ce jour n’est pas encore ouvert ».
create or replace function public.set_day_prayed(p_id uuid, p_day integer, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  n public.group_novenas;
  ends timestamptz;
begin
  select * into n from group_novenas x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(n.group_id, uid) is null then
    raise exception 'neuvaine_inconnue';
  end if;
  if p_day is null or p_day < 1 or p_day > 9 then
    raise exception 'jour_neuvaine_invalide';
  end if;
  if p_on is true then
    select gr.ends_at into ends from groups gr where gr.id = n.group_id;
    if public.group_ended(ends) then
      raise exception 'Ce groupe est terminé';
    end if;
    if p_day > public.novena_current_day(n, now()) then
      raise exception 'Ce jour n’est pas encore ouvert';
    end if;
    insert into novena_days_prayed (novena_id, user_id, day) values (p_id, uid, p_day) on conflict do nothing;
  else
    delete from novena_days_prayed d where d.novena_id = p_id and d.user_id = uid and d.day = p_day;
  end if;
end;
$$;

-- Règle (p_time) ou retire (null) mon rappel quotidien pour cette neuvaine. L'heure est celle du mur de mon téléphone ;
-- le serveur la garde pour mes autres appareils. 3 neuvaines rappelées au plus, et pas de rappel pour une neuvaine finie.
-- Codes : neuvaine_inconnue, heure_invalide. Messages : « Cette neuvaine est terminée », « Tu as déjà 3 neuvaines rappelées ».
create or replace function public.set_novena_reminder(p_id uuid, p_time time)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  n public.group_novenas;
begin
  select * into n from group_novenas x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(n.group_id, uid) is null then
    raise exception 'neuvaine_inconnue';
  end if;
  if p_time is null then
    delete from novena_reminders r where r.novena_id = p_id and r.user_id = uid;
    return;
  end if;
  if public.novena_end(n) <= now() then
    raise exception 'Cette neuvaine est terminée';
  end if;
  if not exists (select 1 from novena_reminders r where r.novena_id = p_id and r.user_id = uid)
    and (
      select count(*) from novena_reminders r
      join group_novenas x on x.id = r.novena_id
      join group_members m on m.group_id = x.group_id and m.user_id = uid
      where r.user_id = uid and x.cancelled_at is null and public.novena_end(x) > now()
    ) >= 3 then
    raise exception 'Tu as déjà 3 neuvaines rappelées';
  end if;
  insert into novena_reminders (novena_id, user_id, remind_time)
  values (p_id, uid, make_time(extract(hour from p_time)::integer, extract(minute from p_time)::integer, 0))
  on conflict (novena_id, user_id) do update set remind_time = excluded.remind_time;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Droits : aides internes fermées, fonctions de l'app ouvertes aux comptes connectés seulement.
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function public.novena_current_day(public.group_novenas, timestamptz) from public, anon, authenticated;
revoke all on function public.novena_end(public.group_novenas) from public, anon, authenticated;
revoke all on function public.novena_json(public.group_novenas, uuid) from public, anon, authenticated;
revoke all on function public.group_members_novenas_cleanup() from public, anon, authenticated;

revoke all on function public.start_novena(uuid, text, text, text, text, text, date, text) from public, anon, authenticated;
revoke all on function public.cancel_novena(uuid) from public, anon, authenticated;
revoke all on function public.list_novenas(uuid) from public, anon, authenticated;
revoke all on function public.get_novena(uuid) from public, anon, authenticated;
revoke all on function public.my_novenas() from public, anon, authenticated;
revoke all on function public.set_day_prayed(uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.set_novena_reminder(uuid, time) from public, anon, authenticated;

grant execute on function public.start_novena(uuid, text, text, text, text, text, date, text) to authenticated;
grant execute on function public.cancel_novena(uuid) to authenticated;
grant execute on function public.list_novenas(uuid) to authenticated;
grant execute on function public.get_novena(uuid) to authenticated;
grant execute on function public.my_novenas() to authenticated;
grant execute on function public.set_day_prayed(uuid, integer, boolean) to authenticated;
grant execute on function public.set_novena_reminder(uuid, time) to authenticated;
