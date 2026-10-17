-- Notifications push de la communauté (Expo Push Service) et préférences de notification.
--
-- Quatre catégories de push, choisies par la personne (notification_prefs, côté serveur : elles suivent le compte sur
-- tous ses appareils) :
--   admin       (défaut : oui)  responsables de groupe (propriétaire et modérateurs) : nouvelle demande d'adhésion,
--                               nouveau signalement à traiter dans le groupe.
--   follows     (défaut : oui)  quelqu'un te suit.
--   group_life  (défaut : NON)  nouvelle intention dans l'un de tes groupes ; « Prière exaucée » sur une intention
--                               que tu portes.
--   group_news  (défaut : NON)  nouveau rendez-vous, neuvaine, Rosaire vivant ou chaîne d'adoration dans l'un de tes groupes.
-- Quatre interrupteurs concernent les rappels LOCAUX (programmés par le téléphone, jamais par le serveur) et sont gardés
-- ici pour suivre le compte : local_gatherings, local_novenas, local_rosary, local_adoration (défaut : oui, comme avant).
-- Le rappel quotidien reste un réglage de l'appareil (src/storage.ts) : il fonctionne aussi sans compte.
-- Par groupe : group_notification_mutes coupe TOUTES les push de ce groupe pour la personne.
--
-- Contenu DISCRET : le titre et le texte d'une push ne contiennent jamais le texte d'une intention, d'un signalement,
-- d'une bio... seulement le type d'événement, le nom du groupe ou le @pseudo. L'adresse (url) ouvre l'écran concerné.
--
-- Chaîne de livraison :
--   événement (trigger « after insert/update » sur group_requests, group_reports, follows, group_intentions,
--   group_gatherings, group_novenas, group_rosaries, adoration_chains)
--     -> push_enqueue : calcule les destinataires, applique préférences, mute du groupe, blocages, suspension, anti-rafale,
--        et écrit une ligne PAR DESTINATAIRE dans push_outbox ;
--     -> push_kick() : appelle l'Edge Function push-dispatch par pg_net (adresse et secret lus dans Vault) ;
--     -> push-dispatch : claim_push_outbox (verrou « for update skip locked »), envoi par lots de 100 à Expo, tickets
--        enregistrés dans push_tickets, jetons « DeviceNotRegistered » supprimés ;
--     -> push-receipts (pg_cron toutes les 15 minutes) : relève les reçus Expo, supprime les jetons invalides.
--   Pourquoi un appel direct depuis les triggers PLUS un job pg_cron « push_retry » chaque minute : l'appel direct livre en
--   quelques secondes, sans attendre la minute suivante ; le job est le filet de sécurité (Edge Function indisponible,
--   démarrage à froid raté, ligne réclamée mais jamais finie) et ne fait rien tant que rien n'attend. Un seul pg_cron
--   aurait ajouté jusqu'à une minute de retard à chaque push ; un seul trigger perdrait les envois ratés.
--   Si pg_net, Vault ou ses deux secrets manquent (base locale non configurée), push_call ne fait rien et ne lève
--   AUCUNE erreur : les lignes restent en attente. Un push trop vieux (plus d'une heure) n'est plus envoyé.
--
-- Anti-rafale : (1) push_outbox (user_id, dedupe_key) est unique : un même événement ne notifie qu'une fois ;
--   (2) push_throttle : au plus UNE push par destinataire, par type et par « portée » (le groupe, ou l'abonné pour
--   « te suit ») toutes les 10 minutes.
--
-- Politique de conservation (appliquée par le job pg_cron « push_purge », chaque jour) :
--   push_outbox : lignes envoyées depuis plus de 7 jours supprimées, et lignes jamais envoyées de plus de 7 jours aussi ;
--   push_tickets : supprimés avec leur ligne d'outbox (cascade) ;
--   push_throttle : lignes de plus d'un jour ; push_tokens : jetons non revus depuis 60 jours (l'app les réenregistre à
--   chaque ouverture).
--
-- Secrets (Vault) à créer en production, jamais dans une migration :
--   push_functions_url     ex. https://<ref>.supabase.co/functions/v1   (sans barre finale)
--   push_dispatch_secret   longue valeur aléatoire, la même que le secret d'Edge Function PUSH_DISPATCH_SECRET
--
-- Droits : aucune table n'est lisible ni modifiable par un client (RLS sans politique, droits retirés) ; tout passe par
-- les fonctions ci-dessous. Les fonctions « claim_* » et « push_report_* » sont réservées au rôle service_role.
--
-- delete_my_account (004) : supprimer auth.users emporte push_tokens, notification_prefs, group_notification_mutes,
--   push_outbox (et par elle push_tickets) et push_throttle par on delete cascade. Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme n'enregistre aucun jeton ni préférence.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------------------------

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_tokens_platform check (platform in ('ios', 'android')),
  constraint push_tokens_format check (token ~ '^(Exponent|Expo)PushToken\[[^\]]{1,200}\]$')
);

create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  admin boolean not null default true,
  follows boolean not null default true,
  group_life boolean not null default false,
  group_news boolean not null default false,
  local_gatherings boolean not null default true,
  local_novenas boolean not null default true,
  local_rosary boolean not null default true,
  local_adoration boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.group_notification_mutes (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_notification_mutes_user_idx on public.group_notification_mutes (user_id);

create table public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  url text not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  attempts smallint not null default 0,
  sent_at timestamptz,
  error text,
  constraint push_outbox_dedupe unique (user_id, dedupe_key)
);

create index push_outbox_pending_idx on public.push_outbox (id) where sent_at is null;
create index push_outbox_sent_idx on public.push_outbox (sent_at) where sent_at is not null;

-- Une ligne d'outbox peut partir vers plusieurs jetons (un par appareil) : un ticket Expo par jeton.
create table public.push_tickets (
  ticket_id text primary key,
  outbox_id bigint not null references public.push_outbox (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  checked_at timestamptz,
  error text
);

create index push_tickets_outbox_idx on public.push_tickets (outbox_id);
create index push_tickets_pending_idx on public.push_tickets (created_at) where checked_at is null;

create table public.push_throttle (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  scope text not null,
  last_at timestamptz not null default now(),
  primary key (user_id, kind, scope)
);

alter table public.push_tokens enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.group_notification_mutes enable row level security;
alter table public.push_outbox enable row level security;
alter table public.push_tickets enable row level security;
alter table public.push_throttle enable row level security;

revoke all on table public.push_tokens from anon, authenticated;
revoke all on table public.notification_prefs from anon, authenticated;
revoke all on table public.group_notification_mutes from anon, authenticated;
revoke all on table public.push_outbox from anon, authenticated;
revoke all on table public.push_tickets from anon, authenticated;
revoke all on table public.push_throttle from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Aides internes (pas de droit d'exécution pour les clients)
-- ---------------------------------------------------------------------------------------------------------------

-- La préférence p_key de p_uid, avec le défaut de la catégorie quand il n'a rien choisi.
create or replace function public.push_pref(p_uid uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (to_jsonb(n) ->> p_key)::boolean,
    p_key not in ('group_life', 'group_news')
  )
  from (select 1) s
  left join notification_prefs n on n.user_id = p_uid;
$$;

-- Les membres d'un groupe (éventuellement seulement ceux de ces rôles).
create or replace function public.push_members(p_group uuid, p_roles text[] default null)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.user_id), '{}')
  from group_members m
  where m.group_id = p_group and (p_roles is null or m.role = any (p_roles));
$$;

-- « Nom du groupe » entre guillemets français, espaces insécables.
create or replace function public.push_quote(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select '«' || chr(160) || p_text || chr(160) || '»';
$$;

-- Appelle une Edge Function (push-dispatch ou push-receipts) par pg_net, adresse et secret lus dans Vault.
-- Ne fait RIEN et ne lève AUCUNE erreur si pg_net, Vault ou l'un des secrets manque : les lignes restent en attente.
create or replace function public.push_call(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  secret text;
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;
  select s.decrypted_secret into base from vault.decrypted_secrets s where s.name = 'push_functions_url';
  select s.decrypted_secret into secret from vault.decrypted_secrets s where s.name = 'push_dispatch_secret';
  if coalesce(base, '') = '' or coalesce(secret, '') = '' then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/' || p_path,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 5000
  );
exception
  when others then
    raise warning 'push_call(%) : %', p_path, sqlerrm;
end;
$$;

create or replace function public.push_kick()
returns void
language sql
security definer
set search_path = public
as $$
  select public.push_call('push-dispatch');
$$;

-- Filet de sécurité (pg_cron, chaque minute) : relance l'envoi s'il reste des lignes à livrer.
create or replace function public.push_retry()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from push_outbox o
    where o.sent_at is null and o.attempts < 5 and o.created_at > now() - interval '1 hour'
      and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
  ) then
    perform public.push_call('push-dispatch');
  end if;
end;
$$;

-- pg_cron, toutes les 15 minutes : relève les reçus s'il reste des tickets à vérifier.
create or replace function public.push_check_receipts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from push_tickets t
    where t.checked_at is null and t.created_at < now() - interval '15 minutes' and t.created_at > now() - interval '24 hours'
  ) then
    perform public.push_call('push-receipts');
  end if;
end;
$$;

-- pg_cron, chaque jour : la politique de conservation décrite en tête de fichier.
create or replace function public.push_purge()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from push_outbox o
  where coalesce(o.sent_at, o.created_at) < now() - interval '7 days';
  delete from push_throttle t where t.last_at < now() - interval '1 day';
  delete from push_tokens k where k.last_seen_at < now() - interval '60 days';
end;
$$;

-- Écrit une ligne d'outbox par destinataire qui doit vraiment être notifié. Renvoie le nombre de lignes écrites.
--   p_actor       : l'auteur de l'événement ; jamais notifié lui-même ; une push déclenchée par un compte suspendu n'existe pas.
--   p_check_block : ne rien envoyer entre deux personnes dont l'une a bloqué l'autre (inutile quand la push ne dit rien de l'auteur).
--   p_scope       : portée de l'anti-rafale (une push par destinataire, type et portée toutes les 10 minutes).
create or replace function public.push_enqueue(
  p_kind text,
  p_pref text,
  p_users uuid[],
  p_actor uuid,
  p_group uuid,
  p_title text,
  p_body text,
  p_url text,
  p_dedupe text,
  p_scope text,
  p_check_block boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
  rows integer;
  total integer := 0;
begin
  if p_actor is not null and public.is_suspended(p_actor) then
    return 0;
  end if;
  foreach u in array coalesce(p_users, '{}') loop
    continue when u is null or u is not distinct from p_actor;
    continue when not exists (select 1 from push_tokens t where t.user_id = u);
    continue when not public.push_pref(u, p_pref);
    continue when p_group is not null
      and exists (select 1 from group_notification_mutes m where m.group_id = p_group and m.user_id = u);
    continue when p_check_block and p_actor is not null and public.is_blocked(u, p_actor);
    -- Anti-rafale : la ligne n'est mise à jour que si la dernière push de ce type date de plus de 10 minutes.
    insert into push_throttle (user_id, kind, scope, last_at) values (u, p_kind, p_scope, now())
    on conflict (user_id, kind, scope) do update set last_at = now()
      where push_throttle.last_at <= now() - interval '10 minutes';
    get diagnostics rows = row_count;
    continue when rows = 0;
    insert into push_outbox (user_id, kind, title, body, url, dedupe_key)
    values (u, p_kind, p_title, p_body, p_url, p_dedupe)
    on conflict (user_id, dedupe_key) do nothing;
    get diagnostics rows = row_count;
    total := total + rows;
  end loop;
  return total;
end;
$$;

revoke all on function public.push_pref(uuid, text) from public, anon, authenticated;
revoke all on function public.push_members(uuid, text[]) from public, anon, authenticated;
revoke all on function public.push_quote(text) from public, anon, authenticated;
revoke all on function public.push_call(text) from public, anon, authenticated;
revoke all on function public.push_kick() from public, anon, authenticated;
revoke all on function public.push_retry() from public, anon, authenticated;
revoke all on function public.push_check_receipts() from public, anon, authenticated;
revoke all on function public.push_purge() from public, anon, authenticated;
revoke all on function public.push_enqueue(text, text, uuid[], uuid, uuid, text, text, text, text, text, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Triggers d'événements
--    Chacun attrape toute erreur : une push ne doit JAMAIS faire échouer l'action de la personne (demande, intention...).
-- ---------------------------------------------------------------------------------------------------------------

-- Nouvelle demande d'adhésion -> propriétaire et modérateurs.
create or replace function public.push_on_group_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gname text;
begin
  select g.name into gname from groups g where g.id = new.group_id;
  if gname is null then
    return new;
  end if;
  if public.push_enqueue(
    'request', 'admin', public.push_members(new.group_id, array['owner', 'moderator']), new.user_id, new.group_id,
    'Nouvelle demande pour rejoindre ' || public.push_quote(gname), 'Touche pour répondre.',
    '/groupe/reglages?id=' || new.group_id, 'request:' || new.group_id || ':' || new.user_id, new.group_id::text, true
  ) > 0 then
    perform public.push_kick();
  end if;
  return new;
exception
  when others then
    raise warning 'push_on_group_request : %', sqlerrm;
    return new;
end;
$$;

-- Nouveau signalement d'une intention de groupe -> propriétaire et modérateurs. La push ne dit rien de l'auteur du
-- signalement : le blocage n'entre donc pas en jeu (un signalement doit toujours parvenir aux responsables).
create or replace function public.push_on_group_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  gname text;
begin
  select i.group_id, g.name into gid, gname
  from group_intentions i join groups g on g.id = i.group_id
  where i.id = new.intention_id;
  if gid is null then
    return new;
  end if;
  if public.push_enqueue(
    'report', 'admin', public.push_members(gid, array['owner', 'moderator']), new.user_id, gid,
    'Un signalement à traiter dans ' || public.push_quote(gname), 'Touche pour le consulter.',
    '/groupe/reglages?id=' || gid, 'report:' || new.intention_id || ':' || new.user_id, gid::text, false
  ) > 0 then
    perform public.push_kick();
  end if;
  return new;
exception
  when others then
    raise warning 'push_on_group_report : %', sqlerrm;
    return new;
end;
$$;

-- Quelqu'un te suit.
create or replace function public.push_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  handle text;
begin
  select p.handle into handle from profiles p where p.id = new.follower_id;
  if handle is null then
    return new;
  end if;
  if public.push_enqueue(
    'follow', 'follows', array[new.followee_id], new.follower_id, null,
    '@' || handle || ' te suit', 'Touche pour voir son profil.',
    '/profil/' || handle, 'follow:' || new.follower_id, new.follower_id::text, true
  ) > 0 then
    perform public.push_kick();
  end if;
  return new;
exception
  when others then
    raise warning 'push_on_follow : %', sqlerrm;
    return new;
end;
$$;

-- Nouvelle intention dans un groupe -> les autres membres.
create or replace function public.push_on_group_intention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gname text;
begin
  if new.hidden or new.withdrawn_at is not null then
    return new;
  end if;
  select g.name into gname from groups g where g.id = new.group_id;
  if gname is null then
    return new;
  end if;
  if public.push_enqueue(
    'intention', 'group_life', public.push_members(new.group_id), new.user_id, new.group_id,
    'Nouvelle intention dans ' || public.push_quote(gname), 'Touche pour ouvrir le groupe.',
    '/groupe/' || new.group_id, 'intention:' || new.id, new.group_id::text, true
  ) > 0 then
    perform public.push_kick();
  end if;
  return new;
exception
  when others then
    raise warning 'push_on_group_intention : %', sqlerrm;
    return new;
end;
$$;

-- Une intention passe à « exaucée » -> ceux qui la portent (et qui sont encore membres du groupe).
create or replace function public.push_on_group_intention_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gname text;
  carriers uuid[];
begin
  if old.answered_at is not null or new.answered_at is null or new.hidden or new.withdrawn_at is not null then
    return new;
  end if;
  select g.name into gname from groups g where g.id = new.group_id;
  if gname is null then
    return new;
  end if;
  select coalesce(array_agg(c.user_id), '{}') into carriers
  from group_carries c
  join group_members m on m.group_id = new.group_id and m.user_id = c.user_id
  where c.intention_id = new.id;
  if public.push_enqueue(
    'answered', 'group_life', carriers, new.user_id, new.group_id,
    'Une intention que tu portes a été exaucée', 'Dans ' || public.push_quote(gname) || '.',
    '/groupe/' || new.group_id, 'answered:' || new.id, new.group_id::text, true
  ) > 0 then
    perform public.push_kick();
  end if;
  return new;
exception
  when others then
    raise warning 'push_on_group_intention_answered : %', sqlerrm;
    return new;
end;
$$;

-- Nouveau rendez-vous, neuvaine, Rosaire vivant ou chaîne d'adoration -> les autres membres du groupe.
-- Arguments du trigger : le type, le début de la phrase, puis le préfixe de l'adresse de l'élément ('' = le groupe).
create or replace function public.push_on_group_news()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb := to_jsonb(new);
  gid uuid := (j ->> 'group_id')::uuid;
  gname text;
  actor uuid := (j ->> 'created_by')::uuid;
  item_url text;
begin
  if (j ->> 'cancelled_at') is not null then
    return new;
  end if;
  select g.name into gname from groups g where g.id = gid;
  if gname is null then
    return new;
  end if;
  item_url := case when tg_argv[2] = '' then '/groupe/' || gid else tg_argv[2] || (j ->> 'id') end;
  if public.push_enqueue(
    tg_argv[0], 'group_news', public.push_members(gid), actor, gid,
    tg_argv[1] || public.push_quote(gname), 'Touche pour ouvrir.',
    item_url, tg_argv[0] || ':' || (j ->> 'id'), gid::text, true
  ) > 0 then
    perform public.push_kick();
  end if;
  return new;
exception
  when others then
    raise warning 'push_on_group_news : %', sqlerrm;
    return new;
end;
$$;

-- Une personne qui quitte un groupe n'y garde pas son interrupteur « Notifications de ce groupe ».
create or replace function public.push_mute_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from group_notification_mutes m where m.group_id = old.group_id and m.user_id = old.user_id;
  return old;
end;
$$;

revoke all on function public.push_on_group_request() from public, anon, authenticated;
revoke all on function public.push_on_group_report() from public, anon, authenticated;
revoke all on function public.push_on_follow() from public, anon, authenticated;
revoke all on function public.push_on_group_intention() from public, anon, authenticated;
revoke all on function public.push_on_group_intention_answered() from public, anon, authenticated;
revoke all on function public.push_on_group_news() from public, anon, authenticated;
revoke all on function public.push_mute_cleanup() from public, anon, authenticated;

create trigger group_requests_push after insert on public.group_requests
  for each row execute function public.push_on_group_request();
create trigger group_reports_push after insert on public.group_reports
  for each row execute function public.push_on_group_report();
create trigger follows_push after insert on public.follows
  for each row execute function public.push_on_follow();
create trigger group_intentions_push after insert on public.group_intentions
  for each row execute function public.push_on_group_intention();
create trigger group_intentions_answered_push after update of answered_at on public.group_intentions
  for each row execute function public.push_on_group_intention_answered();
create trigger group_gatherings_push after insert on public.group_gatherings
  for each row execute function public.push_on_group_news('gathering', 'Nouveau rendez-vous dans ', '');
create trigger group_novenas_push after insert on public.group_novenas
  for each row execute function public.push_on_group_news('novena', 'Nouvelle neuvaine dans ', '/neuvaine/');
create trigger group_rosaries_push after insert on public.group_rosaries
  for each row execute function public.push_on_group_news('rosary', 'Nouveau Rosaire vivant dans ', '/rosaire/');
create trigger adoration_chains_push after insert on public.adoration_chains
  for each row execute function public.push_on_group_news('adoration', 'Nouvelle chaîne d’adoration dans ', '/adoration-chaine/');
create trigger group_members_mute_cleanup after delete on public.group_members
  for each row execute function public.push_mute_cleanup();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Fonctions pour l'app (compte relié exigé : une session anonyme reçoit 'auth')
-- ---------------------------------------------------------------------------------------------------------------

-- Enregistre le jeton Expo de cet appareil. Un jeton déjà connu passe au compte appelant (même téléphone, autre compte).
-- Cinq jetons au plus par compte : les plus anciens sont retirés.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
  t text := btrim(coalesce(p_token, ''));
begin
  if t !~ '^(Exponent|Expo)PushToken\[[^\]]{1,200}\]$' then
    raise exception 'jeton_invalide';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'plateforme_invalide';
  end if;
  insert into push_tokens (token, user_id, platform) values (t, uid, p_platform)
  on conflict (token) do update set user_id = uid, platform = p_platform, last_seen_at = now();
  delete from push_tokens k
  where k.user_id = uid
    and k.token in (
      select x.token from push_tokens x where x.user_id = uid order by x.last_seen_at desc, x.created_at desc offset 5
    );
end;
$$;

-- Retire le jeton de cet appareil (déconnexion, suppression du compte). Ne touche qu'à un jeton du compte appelant.
create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  delete from push_tokens k where k.token = btrim(coalesce(p_token, '')) and k.user_id = uid;
end;
$$;

-- Mes préférences (une seule ligne ; les défauts si je n'ai encore rien choisi).
create or replace function public.get_notification_prefs()
returns table (
  admin boolean,
  follows boolean,
  group_life boolean,
  group_news boolean,
  local_gatherings boolean,
  local_novenas boolean,
  local_rosary boolean,
  local_adoration boolean
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
    coalesce(n.admin, true),
    coalesce(n.follows, true),
    coalesce(n.group_life, false),
    coalesce(n.group_news, false),
    coalesce(n.local_gatherings, true),
    coalesce(n.local_novenas, true),
    coalesce(n.local_rosary, true),
    coalesce(n.local_adoration, true)
  from (select 1) s
  left join notification_prefs n on n.user_id = uid;
end;
$$;

create or replace function public.set_notification_pref(p_key text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  if p_on is null or p_key is null or p_key not in (
    'admin', 'follows', 'group_life', 'group_news', 'local_gatherings', 'local_novenas', 'local_rosary', 'local_adoration'
  ) then
    raise exception 'cle_invalide';
  end if;
  -- La clé est dans la liste ci-dessus : %I suffit à la citer sans risque.
  execute format(
    'insert into public.notification_prefs (user_id, %1$I) values ($1, $2) '
    'on conflict (user_id) do update set %1$I = $2, updated_at = now()',
    p_key
  ) using uid, p_on;
end;
$$;

-- « Notifications de ce groupe » : vrai si j'ai coupé toutes les push de ce groupe.
create or replace function public.is_group_muted(p_group uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  return exists (select 1 from group_notification_mutes m where m.group_id = p_group and m.user_id = uid);
end;
$$;

create or replace function public.set_group_muted(p_group uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  if p_on then
    if public.group_role(p_group, uid) is null then
      raise exception 'groupe_inconnu';
    end if;
    insert into group_notification_mutes (group_id, user_id) values (p_group, uid) on conflict do nothing;
  else
    delete from group_notification_mutes m where m.group_id = p_group and m.user_id = uid;
  end if;
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon, authenticated;
revoke all on function public.unregister_push_token(text) from public, anon, authenticated;
revoke all on function public.get_notification_prefs() from public, anon, authenticated;
revoke all on function public.set_notification_pref(text, boolean) from public, anon, authenticated;
revoke all on function public.is_group_muted(uuid) from public, anon, authenticated;
revoke all on function public.set_group_muted(uuid, boolean) from public, anon, authenticated;

grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.get_notification_prefs() to authenticated;
grant execute on function public.set_notification_pref(text, boolean) to authenticated;
grant execute on function public.is_group_muted(uuid) to authenticated;
grant execute on function public.set_group_muted(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Fonctions des Edge Functions (rôle service_role seulement)
-- ---------------------------------------------------------------------------------------------------------------

-- Réclame jusqu'à p_limit pushes à envoyer, avec les jetons du destinataire. « for update skip locked » : deux appels
-- simultanés ne réclament jamais la même ligne. Une ligne réclamée mais jamais finie redevient disponible après 5 minutes
-- (5 essais au plus). Les pushes de plus d'une heure sont abandonnées (une notification en retard n'a plus de sens), et
-- une ligne sans jeton est close sans envoi.
create or replace function public.claim_push_outbox(p_limit integer default 100)
returns table (id bigint, user_id uuid, kind text, title text, body text, url text, tokens text[])
language plpgsql
security definer
set search_path = public
as $$
begin
  update push_outbox o set sent_at = now(), error = 'expired'
  where o.sent_at is null and o.created_at < now() - interval '1 hour';
  update push_outbox o set sent_at = now(), error = 'no_token'
  where o.sent_at is null and not exists (select 1 from push_tokens t where t.user_id = o.user_id);
  return query
  with picked as (
    select o.id from push_outbox o
    where o.sent_at is null and o.attempts < 5 and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
    order by o.id
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  ), claimed as (
    update push_outbox o set claimed_at = now(), attempts = o.attempts + 1
    from picked where o.id = picked.id
    returning o.id, o.user_id, o.kind, o.title, o.body, o.url
  )
  select c.id, c.user_id, c.kind, c.title, c.body, c.url,
    array(select t.token from push_tokens t where t.user_id = c.user_id order by t.last_seen_at desc)
  from claimed c
  order by c.id;
end;
$$;

-- Enregistre le résultat d'un envoi : [{ "id": 12, "tickets": [{"ticket": "...", "token": "..."}], "error": "...", "retry": false }].
-- Des tickets : la ligne est envoyée. Pas de ticket et retry vrai : elle redevient disponible. Sinon : close avec l'erreur.
create or replace function public.push_report_sent(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  tk jsonb;
  oid bigint;
begin
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    oid := (r ->> 'id')::bigint;
    for tk in select * from jsonb_array_elements(coalesce(r -> 'tickets', '[]'::jsonb)) loop
      insert into push_tickets (ticket_id, outbox_id, token) values (tk ->> 'ticket', oid, tk ->> 'token')
      on conflict do nothing;
    end loop;
    if jsonb_array_length(coalesce(r -> 'tickets', '[]'::jsonb)) > 0
       or not coalesce((r ->> 'retry')::boolean, false) then
      update push_outbox set sent_at = now(), error = left(r ->> 'error', 300) where id = oid;
    else
      update push_outbox set claimed_at = null, error = left(r ->> 'error', 300) where id = oid and sent_at is null;
    end if;
  end loop;
end;
$$;

create or replace function public.push_drop_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_tokens where token = p_token;
$$;

-- Réclame des tickets dont le reçu est prêt (15 minutes après l'envoi, 24 heures au plus : Expo ne les garde pas plus).
create or replace function public.claim_push_tickets(p_limit integer default 1000)
returns table (ticket_id text, token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  update push_tickets t set checked_at = now(), error = 'no_receipt'
  where t.checked_at is null and t.created_at < now() - interval '24 hours';
  return query
  with picked as (
    select t.ticket_id from push_tickets t
    where t.checked_at is null and t.created_at < now() - interval '15 minutes'
      and (t.claimed_at is null or t.claimed_at < now() - interval '10 minutes')
    order by t.created_at
    limit greatest(1, least(coalesce(p_limit, 1000), 1000))
    for update skip locked
  )
  update push_tickets t set claimed_at = now()
  from picked where t.ticket_id = picked.ticket_id
  returning t.ticket_id, t.token;
end;
$$;

-- Enregistre les reçus : [{ "ticket": "...", "status": "ok" | "error" | "missing", "error": "DeviceNotRegistered" }].
-- « DeviceNotRegistered » supprime le jeton. « missing » (reçu pas encore là) laisse le ticket à revérifier.
create or replace function public.push_report_receipts(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  tok text;
begin
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    if r ->> 'status' = 'missing' then
      update push_tickets set claimed_at = null where ticket_id = r ->> 'ticket' and checked_at is null;
      continue;
    end if;
    update push_tickets set checked_at = now(), error = case when r ->> 'status' = 'ok' then null else left(r ->> 'error', 300) end
    where ticket_id = r ->> 'ticket'
    returning token into tok;
    if r ->> 'error' = 'DeviceNotRegistered' and tok is not null then
      delete from push_tokens where token = tok;
    end if;
  end loop;
end;
$$;

revoke all on function public.claim_push_outbox(integer) from public, anon, authenticated;
revoke all on function public.push_report_sent(jsonb) from public, anon, authenticated;
revoke all on function public.push_drop_token(text) from public, anon, authenticated;
revoke all on function public.claim_push_tickets(integer) from public, anon, authenticated;
revoke all on function public.push_report_receipts(jsonb) from public, anon, authenticated;
grant execute on function public.claim_push_outbox(integer) to service_role;
grant execute on function public.push_report_sent(jsonb) to service_role;
grant execute on function public.push_drop_token(text) to service_role;
grant execute on function public.claim_push_tickets(integer) to service_role;
grant execute on function public.push_report_receipts(jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Extensions et tâches planifiées (sans erreur si une extension n'est pas disponible)
-- ---------------------------------------------------------------------------------------------------------------

do $$
begin
  begin
    create extension if not exists pg_net with schema extensions;
  exception when others then
    raise notice 'pg_net indisponible (%) : les push resteront en attente tant qu''il n''est pas activé.', sqlerrm;
  end;
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponible (%) : activez-le puis planifiez push_retry, push_check_receipts et push_purge.', sqlerrm;
  end;
  if to_regnamespace('cron') is not null then
    perform cron.schedule('push-retry', '* * * * *', 'select public.push_retry()');
    perform cron.schedule('push-receipts', '*/15 * * * *', 'select public.push_check_receipts()');
    perform cron.schedule('push-purge', '17 3 * * *', 'select public.push_purge()');
  end if;
exception when others then
  raise notice 'Planification des push impossible : %', sqlerrm;
end;
$$;
