-- Salle de prière en direct.
--
-- Pendant un rendez-vous de groupe (de 10 minutes avant le début jusqu'à la fin, calculé ICI par le serveur), un membre
-- qui a dit « Je suis là » entre dans la salle de cette occurrence : il voit les présents, peut écrire des intentions
-- (ce sont de vraies intentions de groupe) et échange des signaux éphémères (« Amen ») par Supabase Realtime.
--
-- Données : rien de nouveau n'est exposé. Les membres d'un groupe voient déjà les pseudos des autres membres ; la salle ne
-- montre que les pseudos des membres du groupe déclarés présents.
--   group_gatherings.prayer_kind : prière proposée par le rendez-vous (libre, chapelet, office, adoration). Le téléphone
--     ouvre l'écran guidé correspondant, chacun à son rythme : rien n'est synchronisé entre les téléphones.
--   group_intentions.gathering_id / occurrence_start : une intention écrite dans une salle est une intention de groupe
--     (modération, signalements avec masquage à 3, blocage, quota de 10 par jour, retrait quand le membre part : tout
--     est hérité), simplement rattachée au rendez-vous et à l'occurrence où elle a été écrite.
--
-- Fonctions :
--   room_state(rdv)                  l'état de la salle pour un membre (jsonb) ;
--   post_room_intention(rdv, texte)  écrit une intention dans la salle (présent + fenêtre en cours) ;
--   can_use_room(topic)              interne aux politiques Realtime ci-dessous ;
--   list_gatherings, my_gatherings, create_gathering, update_gathering : ajoutent prayer_kind (et, pour my_gatherings,
--     `present`) ; list_group_intentions renvoie en plus le titre du rendez-vous d'origine.
--   Remplacements : un changement de type de retour exige `drop function` puis `create`, avec les droits rétablis plus bas.
--   Compatibilité : create_gathering et update_gathering gardent leurs 9 premiers paramètres, le dixième (p_prayer_kind) a
--   une valeur par défaut ; les lectures gardent leurs colonnes et en ajoutent. Un téléphone qui n'a pas la nouvelle
--   version continue donc de marcher (il ignore simplement les colonnes en plus).
--
-- Temps réel SÉCURISÉ (Realtime Authorization) : un canal PRIVÉ par occurrence, de topic
--   room:<identifiant du rendez-vous>:<début de l'occurrence en millisecondes epoch>
-- Les politiques sur realtime.messages (lire = select, envoyer = insert, broadcast ET presence) appellent can_use_room :
-- compte non anonyme, avec profil, membre du groupe, groupe non terminé, rendez-vous non annulé, occurrence en cours
-- exactement celle du topic, et présent (gathering_presence) à cette occurrence. Tout autre topic est refusé.
-- Le canal ne transporte QUE des signaux : présence { handle }, broadcast `amen` { handle } et `intention` (sans
-- contenu). Les intentions, elles, sont relues par room_state : leur contenu passe toujours par les filtres du serveur
-- (blocage, masquage). Le pseudo d'un signal vient du téléphone : un client modifié pourrait mentir, mais seuls des
-- présents autorisés reçoivent les signaux, et le téléphone n'affiche que les pseudos que room_state a confirmés présents.
-- Limites connues : une autorisation est calculée à l'entrée dans le canal puis gardée pour la connexion (le téléphone
-- quitte le canal à la fin du rendez-vous) ; un blocage entre deux présents ne peut pas se traduire en règle de canal :
-- le téléphone masque les signaux des pseudos que room_state ne liste pas (les bloqués n'y sont pas).
--
-- À FAIRE dans le dashboard Supabase : Realtime > Settings > désactiver « Allow public access » (sinon les canaux
-- privés ne sont pas imposés).
--
-- delete_my_account (004) : supprimer auth.users emporte les intentions de la personne (donc celles de salle) ; sa
--   présence est emportée par on delete cascade (009). Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme n'est membre de rien : can_use_room la refuse.

alter table public.group_gatherings
  add column prayer_kind text not null default 'libre',
  add constraint group_gatherings_prayer_kind check (prayer_kind in ('libre', 'chapelet', 'office', 'adoration'));

alter table public.group_intentions
  add column gathering_id uuid references public.group_gatherings (id) on delete set null,
  add column occurrence_start timestamptz,
  add constraint group_intentions_room_shape check (gathering_id is null or occurrence_start is not null);

create index group_intentions_room_idx on public.group_intentions (gathering_id, occurrence_start)
  where gathering_id is not null and withdrawn_at is null;

-- ---------------------------------------------------------------------------------------------------------------
-- Rendez-vous : prayer_kind
-- ---------------------------------------------------------------------------------------------------------------

drop function public.create_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz);
drop function public.update_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz);

-- Comme en 009, plus p_prayer_kind (libre par défaut). Code ajouté : priere_invalide.
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
  p_prayer_kind text default 'libre'
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
  ends timestamptz;
  new_id uuid;
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  select g.ends_at into ends from groups g where g.id = p_group for update;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  if kind not in ('libre', 'chapelet', 'office', 'adoration') then
    raise exception 'priere_invalide';
  end if;
  perform public.check_gathering_fields(p_title, p_description, p_duration, p_recurrence, p_weekday, p_local_time, p_timezone, p_starts_at);
  if (
    select count(*) from group_gatherings x
    where x.group_id = p_group and x.cancelled_at is null
      and (x.recurrence = 'weekly' or x.starts_at + make_interval(mins => x.duration_min) > now())
  ) >= 10 then
    raise exception 'Ce groupe a déjà 10 rendez-vous';
  end if;
  insert into group_gatherings (group_id, title, description, duration_min, recurrence, weekday, local_time, timezone, starts_at, prayer_kind, created_by)
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
    kind,
    uid
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- p_prayer_kind nul : la prière du rendez-vous ne change pas.
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
  p_prayer_kind text default null
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
  if p_prayer_kind is not null and p_prayer_kind not in ('libre', 'chapelet', 'office', 'adoration') then
    raise exception 'priere_invalide';
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
    starts_at = case when p_recurrence = 'once' then p_starts_at end,
    prayer_kind = coalesce(p_prayer_kind, prayer_kind)
  where id = p_id;
end;
$$;

drop function public.list_gatherings(uuid);

-- Comme en 009, plus prayer_kind en dernière colonne.
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
  prayer_kind text
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
    ) end,
    g.prayer_kind
  from group_gatherings g
  cross join lateral (select public.gathering_current_occurrence(g, now()) as cur) c
  cross join lateral (select public.gathering_next_occurrence(g, now()) as nxt) n
  where g.group_id = p_group and g.cancelled_at is null and (c.cur is not null or n.nxt is not null)
  order by coalesce(c.cur, n.nxt), g.created_at;
end;
$$;

drop function public.my_gatherings();

-- Comme en 009, plus prayer_kind et present (suis-je déclaré présent à l'occurrence en cours ?). Corrige aussi un oubli :
-- un rendez-vous ponctuel déjà commencé (plus de « prochaine » occurrence) mais encore en cours y figure désormais.
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
    g.duration_min,
    g.prayer_kind,
    case when c.cur is null then false else exists (
      select 1 from gathering_presence s
      where s.gathering_id = g.id and s.occurrence_start = c.cur and s.user_id = uid
    ) end
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

-- ---------------------------------------------------------------------------------------------------------------
-- Intentions de groupe : le rendez-vous d'origine
-- ---------------------------------------------------------------------------------------------------------------

drop function public.list_group_intentions(uuid);

-- Comme en 008, plus gathering_title : le titre du rendez-vous où l'intention a été écrite (nul sinon).
create function public.list_group_intentions(p_id uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  mine boolean,
  handle text,
  carries integer,
  carrying boolean,
  answered_at timestamptz,
  thanks text,
  hidden boolean,
  gathering_title text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
begin
  if public.group_role(p_id, uid) is null then
    raise exception 'groupe_inconnu';
  end if;
  return query
  select
    i.id,
    i.body,
    i.created_at,
    i.user_id = uid,
    coalesce(p.handle, ''),
    coalesce(c.count, 0)::integer,
    exists (select 1 from group_carries k where k.intention_id = i.id and k.user_id = uid),
    i.answered_at,
    i.thanks,
    i.hidden,
    x.title
  from group_intentions i
  left join profiles p on p.id = i.user_id
  left join group_carry_counts c on c.intention_id = i.id
  left join group_gatherings x on x.id = i.gathering_id
  where i.group_id = p_id
    and i.withdrawn_at is null
    and (not i.hidden or i.user_id = uid)
    and not public.is_blocked(uid, i.user_id)
  order by i.created_at desc
  limit 50;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- La salle
-- ---------------------------------------------------------------------------------------------------------------

-- Début d'une occurrence, en millisecondes epoch (même arrondi dans room_state et can_use_room).
create function public.occurrence_ms(p_start timestamptz)
returns bigint
language sql
immutable
set search_path = public
as $$
  select floor(extract(epoch from p_start) * 1000)::bigint;
$$;

-- L'état de la salle pour un membre, en jsonb :
--   title, group_id, group_name, prayer_kind, server_now (ISO)           toujours ;
--   open        la fenêtre est ouverte (occurrence en cours, groupe non terminé) ;
--   starts_at, ends_at (ISO), occurrence_ms, present (suis-je déclaré présent), present_count   si open ;
--   present_handles  pseudos des présents déclarés (sans les personnes bloquées dans un sens ou l'autre),
--   intentions       celles écrites pendant CETTE occurrence (mêmes filtres que list_group_intentions)   si open et présent.
-- Code : rdv_inconnu.
create function public.room_state(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  g public.group_gatherings;
  gr public.groups;
  cur timestamptz;
  is_open boolean;
  here boolean := false;
  res jsonb;
begin
  select * into g from group_gatherings x where x.id = p_id and x.cancelled_at is null;
  if not found or public.group_role(g.group_id, uid) is null then
    raise exception 'rdv_inconnu';
  end if;
  select * into gr from groups y where y.id = g.group_id;
  cur := public.gathering_current_occurrence(g, now());
  is_open := cur is not null and not public.group_ended(gr.ends_at);
  res := jsonb_build_object(
    'title', g.title,
    'group_id', g.group_id,
    'group_name', gr.name,
    'prayer_kind', g.prayer_kind,
    'server_now', now(),
    'open', is_open
  );
  if not is_open then
    return res;
  end if;
  here := exists (
    select 1 from gathering_presence s where s.gathering_id = g.id and s.occurrence_start = cur and s.user_id = uid
  );
  res := res || jsonb_build_object(
    'starts_at', cur,
    'ends_at', cur + make_interval(mins => g.duration_min),
    'occurrence_ms', public.occurrence_ms(cur),
    'present', here,
    'present_count', (
      select count(*)::integer from gathering_presence s
      join group_members m on m.group_id = g.group_id and m.user_id = s.user_id
      where s.gathering_id = g.id and s.occurrence_start = cur
    )
  );
  if not here then
    return res;
  end if;
  return res || jsonb_build_object(
    'present_handles', (
      select coalesce(jsonb_agg(h.handle order by h.handle), '[]'::jsonb)
      from (
        select p.handle
        from gathering_presence s
        join group_members m on m.group_id = g.group_id and m.user_id = s.user_id
        join profiles p on p.id = s.user_id
        where s.gathering_id = g.id and s.occurrence_start = cur and not public.is_blocked(uid, s.user_id)
        order by p.handle
        limit 200
      ) h
    ),
    'intentions', (
      select coalesce(jsonb_agg(t.payload order by t.created_at desc), '[]'::jsonb)
      from (
        select
          i.created_at,
          jsonb_build_object(
            'id', i.id,
            'body', i.body,
            'created_at', i.created_at,
            'mine', i.user_id = uid,
            'handle', coalesce(p.handle, ''),
            'carries', coalesce(c.count, 0),
            'carrying', exists (select 1 from group_carries k where k.intention_id = i.id and k.user_id = uid),
            'answered_at', i.answered_at,
            'thanks', i.thanks,
            'hidden', i.hidden
          ) as payload
        from group_intentions i
        left join profiles p on p.id = i.user_id
        left join group_carry_counts c on c.intention_id = i.id
        where i.gathering_id = g.id
          and i.occurrence_start = cur
          and i.group_id = g.group_id
          and i.withdrawn_at is null
          and (not i.hidden or i.user_id = uid)
          and not public.is_blocked(uid, i.user_id)
        order by i.created_at desc
        limit 50
      ) t
    )
  );
end;
$$;

-- Écrit une intention dans la salle : membre, groupe non terminé, fenêtre en cours, déjà déclaré présent. Mêmes règles
-- que post_group_intention (1 à 280 caractères, 10 par jour pour toutes les intentions de groupe).
-- Codes : rdv_inconnu, salle_fermee, pas_present, longueur.
create function public.post_room_intention(p_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  clean text := btrim(coalesce(p_body, ''));
  g public.group_gatherings;
  ends timestamptz;
  cur timestamptz;
  new_id uuid;
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
    raise exception 'salle_fermee';
  end if;
  if not exists (
    select 1 from gathering_presence s where s.gathering_id = g.id and s.occurrence_start = cur and s.user_id = uid
  ) then
    raise exception 'pas_present';
  end if;
  if char_length(clean) < 1 or char_length(clean) > 280 then
    raise exception 'longueur';
  end if;
  if (
    select count(*) from daily_posts d
    where d.user_id = uid and d.kind = 'group_intention' and d.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'Trop d’intentions de groupe pour aujourd’hui';
  end if;
  insert into group_intentions (group_id, user_id, body, gathering_id, occurrence_start)
  values (g.group_id, uid, clean, g.id, cur)
  returning id into new_id;
  insert into daily_posts (user_id, kind) values (uid, 'group_intention');
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Realtime Authorization
-- ---------------------------------------------------------------------------------------------------------------

-- Ce compte peut-il utiliser le canal privé de ce topic ? Jamais d'erreur : un topic invalide donne faux.
-- Appelée par les politiques ci-dessous avec realtime.topic(). security definer : les tables ne sont pas lisibles
-- par les clients.
create function public.can_use_room(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  parts text[];
  g public.group_gatherings;
  ends timestamptz;
  cur timestamptz;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return false;
  end if;
  parts := regexp_match(
    lower(coalesce(p_topic, '')),
    '^room:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9]{1,15})$'
  );
  if parts is null then
    return false;
  end if;
  select * into g from group_gatherings x where x.id = parts[1]::uuid and x.cancelled_at is null;
  if not found then
    return false;
  end if;
  if not exists (select 1 from profiles p where p.id = uid) or public.group_role(g.group_id, uid) is null then
    return false;
  end if;
  select gr.ends_at into ends from groups gr where gr.id = g.group_id;
  if public.group_ended(ends) then
    return false;
  end if;
  cur := public.gathering_current_occurrence(g, now());
  if cur is null or public.occurrence_ms(cur) <> parts[2]::bigint then
    return false;
  end if;
  return exists (
    select 1 from gathering_presence s where s.gathering_id = g.id and s.occurrence_start = cur and s.user_id = uid
  );
exception
  when others then
    return false;
end;
$$;

drop policy if exists "room_receive" on realtime.messages;
drop policy if exists "room_send" on realtime.messages;

-- Recevoir (broadcast et presence).
create policy "room_receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_use_room((select realtime.topic()))
  );

-- Envoyer (broadcast) et se déclarer en ligne (presence track).
create policy "room_send" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_use_room((select realtime.topic()))
  );

-- ---------------------------------------------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function public.occurrence_ms(timestamptz) from public, anon, authenticated;
-- Les politiques s'exécutent avec le rôle du client : can_use_room doit lui être ouverte. Elle ne dit que si
-- l'appelant lui-même a accès à un topic.
revoke all on function public.can_use_room(text) from public, anon, authenticated;
grant execute on function public.can_use_room(text) to authenticated;

revoke all on function public.create_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.update_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.list_gatherings(uuid) from public, anon, authenticated;
revoke all on function public.my_gatherings() from public, anon, authenticated;
revoke all on function public.list_group_intentions(uuid) from public, anon, authenticated;
revoke all on function public.room_state(uuid) from public, anon, authenticated;
revoke all on function public.post_room_intention(uuid, text) from public, anon, authenticated;

grant execute on function public.create_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text) to authenticated;
grant execute on function public.update_gathering(uuid, text, text, integer, text, integer, time, text, timestamptz, text) to authenticated;
grant execute on function public.list_gatherings(uuid) to authenticated;
grant execute on function public.my_gatherings() to authenticated;
grant execute on function public.list_group_intentions(uuid) to authenticated;
grant execute on function public.room_state(uuid) to authenticated;
grant execute on function public.post_room_intention(uuid, text) to authenticated;
