-- Modération éditeur (étape 2) : un rôle de modérateur éditeur, une file globale des éléments signalés, des actions,
-- la suspension de compte et un journal.
--
-- Rôle : app_moderators. Aucun droit client et aucune fonction pour s'y inscrire : on s'y ajoute par SQL, dans le
--   dashboard Supabase (cf. README). is_app_moderator(uid) est interne ; am_i_app_moderator() dit à l'app si elle doit
--   montrer l'écran « Modération ».
--
-- File globale : mod_queue() (modérateur éditeur seulement, sinon 'interdit') liste les éléments signalés et non traités
--   (échos, intentions du fil, profils, prières de vitrine, intentions de groupe), avec l'auteur (@pseudo, jamais son
--   identifiant), les motifs et l'état. reports gagne resolved_at, comme group_reports et profile_reports. Les éléments
--   sont désignés par (kind, id) : 'echo', 'intention' et 'groupe' par leur uuid, 'profil' par le pseudo, 'priere' par
--   « pseudo:identifiant de la prière ». Actions : mod_restore, mod_dismiss, mod_remove. Chacune écrit dans le journal.
--   hide_on_reports (001) ne compte plus que les signalements non traités (comme 015 pour les groupes et les profils),
--   sinon un seul nouveau signalement remasquerait aussitôt un écho rétabli.
--   intentions.auto_hidden distingue une intention retirée par les signalements (rétablissable) d'une intention que son
--   auteur a retirée lui-même (que la modération ne ressuscite jamais).
--
-- Suspension : account_suspensions. Un compte suspendu ne peut plus rien publier : des triggers « before insert or
--   update » sur les tables de contenu (celles de reject_banned_terms en 015, plus profile_passages, group_rosaries,
--   follows, group_members, group_requests) lèvent 'compte_suspendu'. Il peut toujours lire, prier, porter une intention,
--   aimer, se déconnecter et supprimer son compte. À la mise à jour, seul le changement d'une colonne de texte est
--   refusé : les triggers automatiques (masquage par signalements...) ne sont jamais bloqués. L'auteur de l'action est
--   auth.uid() ; pour follows, group_members et group_requests, la personne de la ligne compte aussi.
--
-- Journal : moderation_log, en ajout seulement (aucun droit client ; un trigger refuse tout update/delete/truncate sauf
--   l'anonymisation par on delete set null quand un compte est supprimé). Il est écrit par les actions ci-dessus ET par
--   les actions de modération de groupe de 015 (restore_group_intention, dismiss_group_reports, remove_group_intention,
--   ban_member, unban_member), réécrites ici par create or replace avec la même signature : l'écriture est faite
--   explicitement, avec l'auteur de l'action, plutôt que par des triggers qui se déclencheraient aussi sur les
--   suppressions en cascade (suppression d'un groupe ou d'un compte). Aucune purge automatique n'existe.
--
-- delete_my_account (004) : supprimer auth.users emporte app_moderators et account_suspensions (cascade) ; moderation_log
--   garde ses lignes, avec moderator_id et target_user à null. Rien à modifier.
-- adopt_account (002/003) : rien à changer.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Le rôle de modérateur éditeur
-- ---------------------------------------------------------------------------------------------------------------

create table public.app_moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_moderators enable row level security;
revoke all on table public.app_moderators from anon, authenticated;

create or replace function public.is_app_moderator(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_uid is not null and exists (select 1 from app_moderators m where m.user_id = p_uid);
$$;

-- L'appelant, s'il est modérateur éditeur avec un compte relié ; sinon 'interdit'. Interne.
create or replace function public.require_app_moderator()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) or not public.is_app_moderator(uid) then
    raise exception 'interdit';
  end if;
  return uid;
end;
$$;

create or replace function public.am_i_app_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and public.is_app_moderator(auth.uid());
$$;

revoke all on function public.is_app_moderator(uuid) from public, anon, authenticated;
revoke all on function public.require_app_moderator() from public, anon, authenticated;
revoke all on function public.am_i_app_moderator() from public, anon, authenticated;
grant execute on function public.am_i_app_moderator() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Journal (créé tôt : les autres fonctions y écrivent)
-- ---------------------------------------------------------------------------------------------------------------

create table public.moderation_log (
  id bigint generated always as identity primary key,
  moderator_id uuid references auth.users (id) on delete set null,
  action text not null,
  kind text not null,
  target_ref text,
  target_user uuid references auth.users (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint moderation_log_note_len check (char_length(note) <= 600)
);

create index moderation_log_created_idx on public.moderation_log (created_at desc, id desc);

alter table public.moderation_log enable row level security;
revoke all on table public.moderation_log from anon, authenticated;

-- Ajout seulement. La seule modification permise est l'anonymisation de moderator_id et de target_user (set null).
create or replace function public.moderation_log_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id = old.id
      and new.action = old.action
      and new.kind = old.kind
      and new.target_ref is not distinct from old.target_ref
      and new.note = old.note
      and new.created_at = old.created_at
      and (new.moderator_id is null or new.moderator_id is not distinct from old.moderator_id)
      and (new.target_user is null or new.target_user is not distinct from old.target_user) then
      return new;
    end if;
  end if;
  raise exception 'journal_en_ajout_seulement';
end;
$$;

create trigger moderation_log_append_only
  before update or delete on public.moderation_log
  for each row execute function public.moderation_log_guard();
create trigger moderation_log_no_truncate
  before truncate on public.moderation_log
  for each statement execute function public.moderation_log_guard();

revoke all on function public.moderation_log_guard() from public, anon, authenticated;

-- Écrit une ligne du journal au nom de l'appelant. Interne.
create or replace function public.log_moderation(
  p_action text,
  p_kind text,
  p_ref text,
  p_target_user uuid,
  p_note text default ''
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into moderation_log (moderator_id, action, kind, target_ref, target_user, note)
  values (auth.uid(), p_action, p_kind, p_ref, p_target_user, left(coalesce(p_note, ''), 600));
$$;

revoke all on function public.log_moderation(text, text, text, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Signalements du fil global : resolved_at
-- ---------------------------------------------------------------------------------------------------------------

alter table public.reports add column resolved_at timestamptz;
create index reports_pending_idx on public.reports (echo_id, intention_id) where resolved_at is null;

alter table public.intentions add column auto_hidden boolean not null default false;

-- Remplace la version de 001 : trois signalements NON TRAITÉS masquent l'écho ou retirent l'intention.
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
    select count(*) into n from reports where echo_id = new.echo_id and resolved_at is null;
    if n >= 3 then
      update echoes set hidden = true where id = new.echo_id;
    end if;
  elsif new.intention_id is not null then
    select count(*) into n from reports where intention_id = new.intention_id and resolved_at is null;
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

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Suspension de compte
-- ---------------------------------------------------------------------------------------------------------------

create table public.account_suspensions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  id uuid not null default gen_random_uuid() unique,
  until timestamptz,
  reason text not null,
  suspended_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint account_suspensions_reason_len check (char_length(btrim(reason)) between 1 and 280)
);

alter table public.account_suspensions enable row level security;
revoke all on table public.account_suspensions from anon, authenticated;

-- Ce compte est-il suspendu en ce moment ? Interne.
create or replace function public.is_suspended(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_uid is not null and exists (
    select 1 from account_suspensions s where s.user_id = p_uid and (s.until is null or s.until > now())
  );
$$;

revoke all on function public.is_suspended(uuid) from public, anon, authenticated;

-- Trigger « before insert or update » : les colonnes de texte à surveiller sont les arguments. À l'insertion, toujours
-- contrôlé ; à la mise à jour, seulement si l'une d'elles change.
create or replace function public.reject_suspended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  col text;
  changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    foreach col in array tg_argv loop
      if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
        changed := true;
        exit;
      end if;
    end loop;
    if not changed then
      return new;
    end if;
  end if;
  if public.is_suspended(auth.uid()) then
    raise exception 'compte_suspendu';
  end if;
  return new;
end;
$$;

-- Trigger « before insert » pour les liens (suivre, rejoindre, demander) : l'argument est la colonne qui désigne la
-- personne de la ligne. L'auteur de l'action et cette personne sont tous deux contrôlés.
create or replace function public.reject_suspended_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if public.is_suspended(auth.uid()) or public.is_suspended(who) then
    raise exception 'compte_suspendu';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_suspended() from public, anon, authenticated;
revoke all on function public.reject_suspended_member() from public, anon, authenticated;

create trigger echoes_suspended
  before insert or update on public.echoes
  for each row execute function public.reject_suspended('body');
create trigger intentions_suspended
  before insert or update on public.intentions
  for each row execute function public.reject_suspended('body', 'shown_on_profile');
create trigger profiles_suspended
  before insert or update on public.profiles
  for each row execute function public.reject_suspended('handle', 'bio', 'parish');
create trigger profile_prayers_suspended
  before insert or update on public.profile_prayers
  for each row execute function public.reject_suspended('title', 'body');
create trigger profile_passages_suspended
  before insert on public.profile_passages
  for each row execute function public.reject_suspended();
create trigger groups_suspended
  before insert or update on public.groups
  for each row execute function public.reject_suspended('name', 'description');
create trigger group_intentions_suspended
  before insert or update on public.group_intentions
  for each row execute function public.reject_suspended('body', 'thanks');
create trigger group_gatherings_suspended
  before insert or update on public.group_gatherings
  for each row execute function public.reject_suspended('title', 'description');
create trigger group_novenas_suspended
  before insert or update on public.group_novenas
  for each row execute function public.reject_suspended('title', 'intention', 'custom_prayer');
create trigger adoration_chains_suspended
  before insert or update on public.adoration_chains
  for each row execute function public.reject_suspended('title', 'intention', 'place');
create trigger group_rosaries_suspended
  before insert on public.group_rosaries
  for each row execute function public.reject_suspended();
create trigger follows_suspended
  before insert on public.follows
  for each row execute function public.reject_suspended_member('follower_id');
create trigger group_members_suspended
  before insert on public.group_members
  for each row execute function public.reject_suspended_member('user_id');
create trigger group_requests_suspended
  before insert on public.group_requests
  for each row execute function public.reject_suspended_member('user_id');

-- Ma suspension en cours (zéro ligne si je ne suis pas suspendu). `until` nul : sans fin.
create or replace function public.my_suspension()
returns table (until timestamptz, reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  select s.until, s.reason
  from account_suspensions s
  where s.user_id = auth.uid() and (s.until is null or s.until > now());
end;
$$;

revoke all on function public.my_suspension() from public, anon, authenticated;
grant execute on function public.my_suspension() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. La file globale
-- ---------------------------------------------------------------------------------------------------------------

-- Uuid lu dans un identifiant texte ; 'introuvable' s'il n'en est pas un. Interne.
create or replace function public.mod_uuid(p_id text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return p_id::uuid;
exception
  when others then
    raise exception 'introuvable';
end;
$$;

-- L'auteur d'un élément désigné par (kind, id) ; 'kind_invalide' ou 'introuvable'. Interne.
create or replace function public.mod_author_of(p_kind text, p_id text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  author uuid;
  h text;
  pid text;
begin
  if p_kind = 'echo' then
    select e.user_id into author from echoes e where e.id = public.mod_uuid(p_id);
  elsif p_kind = 'intention' then
    select i.user_id into author from intentions i where i.id = public.mod_uuid(p_id);
  elsif p_kind = 'groupe' then
    select i.user_id into author from group_intentions i where i.id = public.mod_uuid(p_id);
  elsif p_kind = 'profil' then
    select p.id into author from profiles p where p.handle = lower(btrim(coalesce(p_id, '')));
  elsif p_kind = 'priere' then
    h := lower(btrim(split_part(coalesce(p_id, ''), ':', 1)));
    pid := substr(coalesce(p_id, ''), position(':' in coalesce(p_id, '')) + 1);
    select x.user_id into author
    from profile_prayers x join profiles p on p.id = x.user_id
    where p.handle = h and x.prayer_id = pid;
  else
    raise exception 'kind_invalide';
  end if;
  if author is null then
    raise exception 'introuvable';
  end if;
  return author;
end;
$$;

-- Ce que le journal garde pour désigner l'élément : son identifiant, jamais un pseudo (un pseudo resterait après la
-- suppression du compte). Un profil n'a pas d'autre référence que son auteur (target_user) ; une prière de vitrine, que
-- son identifiant. Interne.
create or replace function public.mod_ref(p_kind text, p_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_kind = 'profil' then null
    when p_kind = 'priere' then substr(coalesce(p_id, ''), position(':' in coalesce(p_id, '')) + 1)
    else p_id
  end;
$$;

revoke all on function public.mod_uuid(text) from public, anon, authenticated;
revoke all on function public.mod_author_of(text, text) from public, anon, authenticated;
revoke all on function public.mod_ref(text, text) from public, anon, authenticated;

-- Modérateur éditeur : les éléments signalés et pas encore traités (200 au plus), les masqués ou retirés d'abord puis les
-- plus signalés. `handle` est nul quand l'auteur n'a pas de profil ; `group_name` n'est renseigné que pour 'groupe'.
create or replace function public.mod_queue()
returns table (
  kind text,
  id text,
  body text,
  handle text,
  group_name text,
  hidden boolean,
  suspended boolean,
  reports integer,
  insulte integer,
  inapproprie integer,
  spam integer,
  autre integer,
  first_reported_at timestamptz,
  last_reported_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.require_app_moderator();
  return query
  with items as (
    select 'echo'::text as k, e.id::text as ref, e.body as txt, e.user_id as author, null::text as gname, e.hidden as hid,
           r.reason, r.created_at as at
    from reports r join echoes e on e.id = r.echo_id
    where r.resolved_at is null
    union all
    select 'intention', i.id::text, i.body, i.user_id, null, i.withdrawn_at is not null, r.reason, r.created_at
    from reports r join intentions i on i.id = r.intention_id
    where r.resolved_at is null
    union all
    select 'profil', p.handle, concat_ws(E'\n', nullif(p.bio, ''), nullif(p.parish, '')), p.id, null,
           p.flagged_at is not null, r.reason, r.created_at
    from profile_reports r join profiles p on p.id = r.target_id
    where r.resolved_at is null and r.subject = 'profil'
    union all
    select 'priere', p.handle || ':' || x.prayer_id, x.title || E'\n' || x.body, p.id, null,
           x.hidden_at is not null, r.reason, r.created_at
    from profile_reports r
    join profiles p on p.id = r.target_id
    join profile_prayers x on x.user_id = r.target_id and x.prayer_id = r.prayer_id
    where r.resolved_at is null and r.subject = 'priere'
    union all
    select 'groupe', i.id::text, i.body, i.user_id, g.name, i.hidden, r.reason, r.created_at
    from group_reports r
    join group_intentions i on i.id = r.intention_id
    join groups g on g.id = i.group_id
    where r.resolved_at is null and i.withdrawn_at is null
  )
  select
    t.k,
    t.ref,
    max(t.txt),
    max(p.handle),
    max(t.gname),
    bool_or(t.hid),
    public.is_suspended(t.author),
    count(*)::integer,
    (count(*) filter (where t.reason = 'insulte'))::integer,
    (count(*) filter (where t.reason = 'inapproprie'))::integer,
    (count(*) filter (where t.reason = 'spam'))::integer,
    (count(*) filter (where t.reason = 'autre'))::integer,
    min(t.at),
    max(t.at)
  from items t
  left join profiles p on p.id = t.author
  group by t.k, t.ref, t.author
  order by bool_or(t.hid) desc, count(*) desc, max(t.at) desc, t.ref
  limit 200;
end;
$$;

revoke all on function public.mod_queue() from public, anon, authenticated;
grant execute on function public.mod_queue() to authenticated;

-- Clôt les signalements en cours d'un élément. Interne.
create or replace function public.mod_close_reports(p_kind text, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
begin
  if p_kind = 'echo' then
    update reports set resolved_at = now() where echo_id = public.mod_uuid(p_id) and resolved_at is null;
  elsif p_kind = 'intention' then
    update reports set resolved_at = now() where intention_id = public.mod_uuid(p_id) and resolved_at is null;
  elsif p_kind = 'groupe' then
    perform public.resolve_group_reports(public.mod_uuid(p_id));
  elsif p_kind = 'profil' then
    author := public.mod_author_of(p_kind, p_id);
    update profile_reports set resolved_at = now()
    where target_id = author and subject = 'profil' and resolved_at is null;
  elsif p_kind = 'priere' then
    author := public.mod_author_of(p_kind, p_id);
    update profile_reports set resolved_at = now()
    where target_id = author and subject = 'priere'
      and prayer_id = substr(p_id, position(':' in p_id) + 1) and resolved_at is null;
  end if;
end;
$$;

revoke all on function public.mod_close_reports(text, text) from public, anon, authenticated;

-- Rend visible ce qui était masqué (ou garde visible ce qui l'est) et clôt les signalements. Interne : mod_restore et
-- mod_dismiss ne diffèrent que par la ligne du journal.
create or replace function public.mod_clear(p_action text, p_kind text, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid := public.mod_author_of(p_kind, p_id);
begin
  if p_kind = 'echo' then
    update echoes set hidden = false where id = public.mod_uuid(p_id);
  elsif p_kind = 'intention' then
    -- Une intention que son auteur a retirée lui-même le reste.
    update intentions set withdrawn_at = null, auto_hidden = false
    where id = public.mod_uuid(p_id) and auto_hidden;
  elsif p_kind = 'groupe' then
    update group_intentions set hidden = false where id = public.mod_uuid(p_id);
  elsif p_kind = 'profil' then
    update profiles set flagged_at = null where id = author;
  elsif p_kind = 'priere' then
    update profile_prayers set hidden_at = null
    where user_id = author and prayer_id = substr(p_id, position(':' in p_id) + 1);
  end if;
  perform public.mod_close_reports(p_kind, p_id);
  perform public.log_moderation(p_action, p_kind, public.mod_ref(p_kind, p_id), author, '');
end;
$$;

revoke all on function public.mod_clear(text, text, text) from public, anon, authenticated;

create or replace function public.mod_restore(p_kind text, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_app_moderator();
  perform public.mod_clear('restore', p_kind, p_id);
end;
$$;

create or replace function public.mod_dismiss(p_kind text, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_app_moderator();
  perform public.mod_clear('dismiss', p_kind, p_id);
end;
$$;

-- Retire l'élément : écho supprimé, intention retirée, bio et paroisse effacées, prière de vitrine supprimée,
-- intention de groupe retirée. Les signalements sont clos.
create or replace function public.mod_remove(p_kind text, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
begin
  perform public.require_app_moderator();
  author := public.mod_author_of(p_kind, p_id);
  perform public.mod_close_reports(p_kind, p_id);
  if p_kind = 'echo' then
    delete from echoes where id = public.mod_uuid(p_id);
  elsif p_kind = 'intention' then
    update intentions set withdrawn_at = coalesce(withdrawn_at, now()), auto_hidden = false
    where id = public.mod_uuid(p_id);
  elsif p_kind = 'groupe' then
    update group_intentions set withdrawn_at = coalesce(withdrawn_at, now()) where id = public.mod_uuid(p_id);
  elsif p_kind = 'profil' then
    update profiles set bio = null, parish = null, flagged_at = null where id = author;
  elsif p_kind = 'priere' then
    delete from profile_prayers where user_id = author and prayer_id = substr(p_id, position(':' in p_id) + 1);
  end if;
  perform public.log_moderation('remove', p_kind, public.mod_ref(p_kind, p_id), author, '');
end;
$$;

revoke all on function public.mod_restore(text, text) from public, anon, authenticated;
revoke all on function public.mod_dismiss(text, text) from public, anon, authenticated;
revoke all on function public.mod_remove(text, text) from public, anon, authenticated;
grant execute on function public.mod_restore(text, text) to authenticated;
grant execute on function public.mod_dismiss(text, text) to authenticated;
grant execute on function public.mod_remove(text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Suspendre et lever une suspension
-- ---------------------------------------------------------------------------------------------------------------

-- Suspend un compte. Jamais soi-même, jamais un autre modérateur éditeur. p_days nul : sans fin. Interne.
create or replace function public.mod_apply_suspension(p_target uuid, p_days integer, p_reason text, p_kind text, p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_app_moderator();
  why text := btrim(coalesce(p_reason, ''));
  ends timestamptz;
begin
  if p_days is not null and (p_days < 1 or p_days > 3650) then
    raise exception 'duree_invalide';
  end if;
  if char_length(why) < 1 or char_length(why) > 280 then
    raise exception 'motif_invalide';
  end if;
  if p_target is null then
    raise exception 'introuvable';
  end if;
  if p_target = uid or public.is_app_moderator(p_target) then
    raise exception 'interdit';
  end if;
  ends := case when p_days is null then null else now() + make_interval(days => p_days) end;
  insert into account_suspensions (user_id, until, reason, suspended_by)
  values (p_target, ends, why, uid)
  on conflict (user_id) do update
    set until = excluded.until, reason = excluded.reason, suspended_by = excluded.suspended_by, created_at = now();
  perform public.log_moderation(
    'suspend',
    p_kind,
    p_ref,
    p_target,
    case when p_days is null then 'Sans fin' else p_days::text || ' j' end || ' : ' || why
  );
end;
$$;

revoke all on function public.mod_apply_suspension(uuid, integer, text, text, text) from public, anon, authenticated;

-- Suspend l'AUTEUR de l'élément signalé, sans exposer son identifiant au client.
create or replace function public.mod_suspend(p_kind text, p_id text, p_days integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_app_moderator();
  perform public.mod_apply_suspension(
    public.mod_author_of(p_kind, p_id), p_days, p_reason, p_kind, public.mod_ref(p_kind, p_id)
  );
end;
$$;

create or replace function public.mod_suspend_handle(p_handle text, p_days integer, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h text := lower(btrim(coalesce(p_handle, '')));
begin
  perform public.require_app_moderator();
  perform public.mod_apply_suspension(
    (select p.id from profiles p where p.handle = h),
    p_days,
    p_reason,
    'compte',
    null
  );
end;
$$;

-- Lève une suspension désignée par un pseudo ou par l'identifiant de la suspension (mod_suspensions).
create or replace function public.mod_unsuspend(p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text := lower(btrim(coalesce(p_ref, '')));
  target uuid;
  sid uuid;
begin
  perform public.require_app_moderator();
  if ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    delete from account_suspensions s where s.id = ref::uuid returning s.user_id, s.id into target, sid;
  else
    delete from account_suspensions s using profiles p
    where p.handle = ref and s.user_id = p.id
    returning s.user_id, s.id into target, sid;
  end if;
  if target is null then
    raise exception 'introuvable';
  end if;
  perform public.log_moderation('unsuspend', 'compte', sid::text, target, '');
end;
$$;

-- Les suspensions en cours, les plus récentes d'abord. `id` désigne la suspension (pas le compte).
create or replace function public.mod_suspensions()
returns table (id uuid, handle text, until timestamptz, reason text, suspended_by text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.require_app_moderator();
  return query
  select s.id, p.handle, s.until, s.reason, w.handle, s.created_at
  from account_suspensions s
  left join profiles p on p.id = s.user_id
  left join profiles w on w.id = s.suspended_by
  where s.until is null or s.until > now()
  order by s.created_at desc, s.id
  limit 200;
end;
$$;

revoke all on function public.mod_suspend(text, text, integer, text) from public, anon, authenticated;
revoke all on function public.mod_suspend_handle(text, integer, text) from public, anon, authenticated;
revoke all on function public.mod_unsuspend(text) from public, anon, authenticated;
revoke all on function public.mod_suspensions() from public, anon, authenticated;
grant execute on function public.mod_suspend(text, text, integer, text) to authenticated;
grant execute on function public.mod_suspend_handle(text, integer, text) to authenticated;
grant execute on function public.mod_unsuspend(text) to authenticated;
grant execute on function public.mod_suspensions() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Lire le journal
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.mod_log(p_limit integer default 100)
returns table (
  id bigint,
  created_at timestamptz,
  moderator text,
  action text,
  kind text,
  target_ref text,
  target_handle text,
  note text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.require_app_moderator();
  return query
  select l.id, l.created_at, m.handle, l.action, l.kind, l.target_ref, t.handle, l.note
  from moderation_log l
  left join profiles m on m.id = l.moderator_id
  left join profiles t on t.id = l.target_user
  order by l.created_at desc, l.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.mod_log(integer) from public, anon, authenticated;
grant execute on function public.mod_log(integer) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Les actions de modération de groupe écrivent aussi dans le journal (mêmes signatures et mêmes droits qu'en 015)
-- ---------------------------------------------------------------------------------------------------------------

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
  perform public.log_moderation(
    'group_restore', 'groupe', p_intention_id::text, (select i.user_id from group_intentions i where i.id = p_intention_id), ''
  );
end;
$$;

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
  perform public.log_moderation(
    'group_dismiss', 'groupe', p_intention_id::text, (select i.user_id from group_intentions i where i.id = p_intention_id), ''
  );
end;
$$;

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
  perform public.log_moderation(
    'group_remove', 'groupe', p_intention_id::text, (select i.user_id from group_intentions i where i.id = p_intention_id), ''
  );
end;
$$;

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
  perform public.log_moderation('group_ban', 'groupe', p_id::text, target, '');
end;
$$;

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
  target uuid;
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  delete from group_bans b
  using profiles p
  where p.handle = h and b.group_id = p_id and b.user_id = p.id
  returning b.user_id into target;
  if target is not null then
    perform public.log_moderation('group_unban', 'groupe', p_id::text, target, '');
  end if;
end;
$$;

revoke all on function public.restore_group_intention(uuid) from public, anon, authenticated;
revoke all on function public.dismiss_group_reports(uuid) from public, anon, authenticated;
revoke all on function public.remove_group_intention(uuid) from public, anon, authenticated;
revoke all on function public.ban_member(uuid, text) from public, anon, authenticated;
revoke all on function public.unban_member(uuid, text) from public, anon, authenticated;
grant execute on function public.restore_group_intention(uuid) to authenticated;
grant execute on function public.dismiss_group_reports(uuid) to authenticated;
grant execute on function public.remove_group_intention(uuid) to authenticated;
grant execute on function public.ban_member(uuid, text) to authenticated;
grant execute on function public.unban_member(uuid, text) to authenticated;
