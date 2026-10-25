-- Retours des testeurs : un message écrit depuis les réglages (Réglages > Envoyer un retour), lu par les modérateurs de
-- l'éditeur dans l'écran « Modération » (onglet « Retours »).
--
-- feedback : aucun droit client. On écrit par send_feedback (toute session, anonyme comprise : un testeur n'a pas
--   forcément de compte relié), on lit par mod_feedback et on classe par mod_resolve_feedback (modérateur éditeur
--   seulement, sinon 'interdit').
--   Ce qui part : le type (bug, idée, autre), le message, une adresse facultative pour répondre, la version de l'app, le
--   système (android, ios, web) et sa version. Rien de la progression ni de la liste de confession.
--   Supprimer son compte efface ses retours (on delete cascade).
--
-- adopt_account (002/003) : redéfini en fin de fichier, même corps que 003, pour déplacer aussi les retours de
--   l'anonyme vers le compte. Sans cela, ils resteraient sur la session anonyme d'origine et survivraient à la
--   suppression du compte.
--
-- Limites : 2 000 caractères pour le message, 200 pour l'adresse, 5 retours par tranche de 10 minutes et 30 par jour et
--   par compte.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'idee', 'autre')),
  body text not null check (char_length(body) between 1 and 2000),
  contact text check (contact is null or char_length(contact) <= 200),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  platform text check (platform is null or char_length(platform) <= 20),
  os_version text check (os_version is null or char_length(os_version) <= 40),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index feedback_user_created on public.feedback (user_id, created_at desc);
create index feedback_open on public.feedback (created_at desc) where resolved_at is null;

alter table public.feedback enable row level security;
revoke all on table public.feedback from anon, authenticated;

-- Un texte facultatif : nul s'il est vide, sinon raccourci à `n` caractères.
create or replace function public.feedback_word(p_value text, n integer)
returns text
language sql
immutable
as $$
  select nullif(left(btrim(coalesce(p_value, '')), n), '');
$$;

revoke all on function public.feedback_word(text, integer) from public, anon, authenticated;

create or replace function public.send_feedback(
  p_kind text,
  p_body text,
  p_contact text default null,
  p_app_version text default null,
  p_platform text default null,
  p_os_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_contact text := btrim(coalesce(p_contact, ''));
begin
  if uid is null then
    raise exception 'auth';
  end if;
  if p_kind is null or p_kind not in ('bug', 'idee', 'autre') then
    raise exception 'kind_invalide';
  end if;
  if char_length(v_body) = 0 then
    raise exception 'retour_vide';
  end if;
  if char_length(v_body) > 2000 or char_length(v_contact) > 200 then
    raise exception 'longueur';
  end if;
  if (select count(*) from feedback f where f.user_id = uid and f.created_at > now() - interval '10 minutes') >= 5
    or (select count(*) from feedback f where f.user_id = uid and f.created_at > now() - interval '1 day') >= 30 then
    raise exception 'trop_de_retours';
  end if;
  insert into feedback (user_id, kind, body, contact, app_version, platform, os_version)
  values (
    uid,
    p_kind,
    v_body,
    nullif(v_contact, ''),
    public.feedback_word(p_app_version, 40),
    public.feedback_word(p_platform, 20),
    public.feedback_word(p_os_version, 40)
  );
end;
$$;

revoke all on function public.send_feedback(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.send_feedback(text, text, text, text, text, text) to authenticated;

-- Les retours, les non classés d'abord puis du plus récent au plus ancien. L'auteur est désigné par son @pseudo s'il a
-- un profil, jamais par son identifiant.
create or replace function public.mod_feedback(p_limit integer default 100)
returns table (
  id uuid,
  created_at timestamptz,
  kind text,
  body text,
  contact text,
  app_version text,
  platform text,
  os_version text,
  handle text,
  anonymous boolean,
  resolved_at timestamptz
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
  select f.id, f.created_at, f.kind, f.body, f.contact, f.app_version, f.platform, f.os_version, p.handle,
    coalesce(u.is_anonymous, false), f.resolved_at
  from feedback f
  left join profiles p on p.id = f.user_id
  left join auth.users u on u.id = f.user_id
  order by (f.resolved_at is null) desc, f.created_at desc, f.id
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.mod_feedback(integer) from public, anon, authenticated;
grant execute on function public.mod_feedback(integer) to authenticated;

-- Classe un retour (p_resolved) ou le remet dans les non classés.
create or replace function public.mod_resolve_feedback(p_id uuid, p_resolved boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_app_moderator();
  update feedback set resolved_at = case when coalesce(p_resolved, true) then coalesce(resolved_at, now()) end
  where id = p_id;
  if not found then
    raise exception 'introuvable';
  end if;
end;
$$;

revoke all on function public.mod_resolve_feedback(uuid, boolean) from public, anon, authenticated;
grant execute on function public.mod_resolve_feedback(uuid, boolean) to authenticated;

-- Même corps que 003, plus le déplacement des retours. Les droits d'exécution de la fonction sont conservés.
create or replace function public.adopt_account(p_nonce uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  src uuid;
begin
  if uid is null then
    raise exception 'auth';
  end if;
  select from_user into src
  from account_adoptions
  where nonce = p_nonce and expires_at > now();
  if src is null then
    raise exception 'nonce';
  end if;
  if src = uid then
    delete from account_adoptions where nonce = p_nonce;
    return;
  end if;

  delete from likes l
  where l.user_id = src
    and exists (select 1 from likes mine where mine.user_id = uid and mine.target = l.target);
  update likes set user_id = uid where user_id = src;

  delete from echoes e
  where e.user_id = src
    and exists (select 1 from echoes mine where mine.user_id = uid and mine.target = e.target);
  update echoes set user_id = uid where user_id = src;

  update intentions set user_id = uid where user_id = src;

  delete from carries c
  where c.user_id = src
    and exists (select 1 from carries mine where mine.user_id = uid and mine.intention_id = c.intention_id);
  update carries set user_id = uid where user_id = src;

  delete from reports r
  where r.user_id = src
    and (
      (r.echo_id is not null and exists (select 1 from reports mine where mine.user_id = uid and mine.echo_id = r.echo_id))
      or (r.intention_id is not null and exists (select 1 from reports mine where mine.user_id = uid and mine.intention_id = r.intention_id))
    );
  update reports set user_id = uid where user_id = src;

  -- Ce que set_carry, report_echo et report_intention refusent d'ordinaire : porter ou signaler le sien.
  delete from carries c
  using intentions i
  where c.intention_id = i.id and c.user_id = uid and i.user_id = uid;

  delete from reports r
  using echoes e
  where r.echo_id = e.id and r.user_id = uid and e.user_id = uid;

  delete from reports r
  using intentions i
  where r.intention_id = i.id and r.user_id = uid and i.user_id = uid;

  update daily_posts set user_id = uid where user_id = src;
  update feedback set user_id = uid where user_id = src;

  delete from user_state where user_id = src;
  delete from account_adoptions where nonce = p_nonce;
end;
$$;
