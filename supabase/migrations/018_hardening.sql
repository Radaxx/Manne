-- Durcissement.
--   1. Signaler (échos et intentions du fil) demande un compte relié : un compte anonyme se crée en un clic et ne doit
--      pas pouvoir masquer le contenu d'autrui. Les signalements de groupe et de profil passaient déjà par linked_uid().
--      Le masquage à trois signalements ne compte plus que les signalements de comptes non anonymes.
--      Publier anonymement reste permis (décision produit).
--   2. user_state : garde côté serveur (la liste de confession ne part jamais, taille bornée).
--   3. list_members : un membre bloqué (dans un sens ou l'autre) n'apparaît plus avec son pseudo.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Signalements réservés aux comptes reliés
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.report_echo(p_id uuid, p_reason text default null)
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
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'compte_requis';
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

create or replace function public.report_intention(p_id uuid, p_reason text default null)
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
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'compte_requis';
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

revoke all on function public.report_echo(uuid, text) from public, anon, authenticated;
revoke all on function public.report_intention(uuid, text) from public, anon, authenticated;
grant execute on function public.report_echo(uuid, text) to authenticated;
grant execute on function public.report_intention(uuid, text) to authenticated;

-- Les seuils ne comptent que les signalements non traités ET issus d'un compte non anonyme.
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
    select count(*) into n
    from reports r
    join auth.users u on u.id = r.user_id
    where r.echo_id = new.echo_id and r.resolved_at is null and not u.is_anonymous;
    if n >= 3 then
      update echoes set hidden = true where id = new.echo_id;
    end if;
  elsif new.intention_id is not null then
    select count(*) into n
    from reports r
    join auth.users u on u.id = r.user_id
    where r.intention_id = new.intention_id and r.resolved_at is null and not u.is_anonymous;
    if n >= 3 then
      update intentions set withdrawn_at = now(), auto_hidden = true
      where id = new.intention_id and withdrawn_at is null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.hide_on_reports() from public, anon, authenticated;
grant execute on function public.hide_on_reports() to authenticated;

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
  join auth.users u on u.id = r.user_id
  where r.intention_id = new.intention_id and r.resolved_at is null and not u.is_anonymous;
  if n >= 3 then
    update group_intentions set hidden = true where id = new.intention_id;
  end if;
  return new;
end;
$$;

revoke all on function public.hide_group_intention_on_reports() from public, anon, authenticated;

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
  join auth.users u on u.id = r.reporter_id
  where r.target_id = new.target_id
    and r.subject = new.subject
    and coalesce(r.prayer_id, '') = coalesce(new.prayer_id, '')
    and r.resolved_at is null
    and not u.is_anonymous;
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

revoke all on function public.hide_profile_on_reports() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. user_state : la liste de confession ne part jamais, et la taille est bornée
-- ---------------------------------------------------------------------------------------------------------------
-- cloudState (src/sync.ts) envoie confession = { items: [], lastConfession } et confessionLock = true : le serveur
-- impose la même chose à items, sans toucher au reste.

create or replace function public.user_state_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_column_size(new.state) > 524288 then
    raise exception 'etat_trop_gros';
  end if;
  if jsonb_typeof(new.state -> 'confession') = 'object' and new.state -> 'confession' ? 'items' then
    new.state := jsonb_set(new.state, '{confession,items}', '[]'::jsonb);
  end if;
  return new;
end;
$$;

revoke all on function public.user_state_guard() from public, anon, authenticated;

create trigger user_state_guard
  before insert or update on public.user_state
  for each row execute function public.user_state_guard();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. list_members : masquer les paires bloquées
-- ---------------------------------------------------------------------------------------------------------------
-- Même signature et même type de retour. Pour un membre bloqué (dans un sens ou l'autre), handle vaut null, sauf si l'appelant est propriétaire ou modérateur du groupe (il doit pouvoir agir sur les membres) : la ligne
-- reste dans le résultat avec son rôle, mais readMember (src/groups.ts) l'écarte tant qu'il exige un pseudo.

create or replace function public.list_members(p_id uuid)
returns table (handle text, role text, joined_at timestamptz, mine boolean)
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
    case
      when m.user_id <> uid and public.is_blocked(uid, m.user_id) and public.group_role(p_id, uid) not in ('owner', 'moderator')
        then null
      else p.handle
    end,
    m.role,
    m.joined_at,
    m.user_id = uid
  from group_members m
  join profiles p on p.id = m.user_id
  where m.group_id = p_id
  order by case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end, m.joined_at asc, p.handle asc
  limit 200;
end;
$$;

revoke all on function public.list_members(uuid) from public, anon, authenticated;
grant execute on function public.list_members(uuid) to authenticated;
