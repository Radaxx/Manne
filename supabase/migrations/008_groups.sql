-- Groupes de prière.
--
-- Qui peut être membre : un compte RELIÉ (non anonyme) qui a un PROFIL. Le pseudo est visible des autres membres.
-- Toutes les fonctions passent par profile_uid() (qui s'appuie sur linked_uid() de 005) : une session anonyme n'a aucun accès.
--
-- Trois types (groups.kind) :
--   fraternite : privée, introuvable (ni recherche, ni carte par identifiant pour un non-membre). On y entre
--                uniquement avec le code d'invitation (adhésion immédiate).
--   communaute : trouvable par son nom. On envoie une demande qu'un propriétaire ou un modérateur accepte ou refuse.
--                Le code d'invitation fait aussi entrer directement.
--   ephemere   : trouvable par son nom, adhésion immédiate, ends_at obligatoire (future, un an au plus). Une fois
--                ends_at passée, le groupe est en lecture seule (plus d'intention, plus de membre) et n'apparaît plus
--                dans la recherche.
--
-- Rôles : owner (un seul, garanti par un index unique partiel), moderator, member.
--   Propriétaire ou modérateur : accepter ou refuser les demandes, retirer une intention, exclure un membre
--     (jamais le propriétaire ; un modérateur n'exclut pas un modérateur).
--   Propriétaire seul : modifier nom et description, régénérer le code, nommer ou retirer les modérateurs,
--     transférer la propriété, supprimer le groupe.
--   Quitter : tout membre ; le propriétaire doit d'abord transférer (ou supprimer le groupe).
--
-- Limites : 200 membres par groupe, 20 groupes par personne, 3 créations de groupe par jour, 10 intentions de groupe
-- par jour, 30 codes d'invitation inconnus par jour (daily_posts, kinds 'group', 'group_intention', 'code_try').
--
-- Visibilité : seuls les membres voient les membres (pseudos et rôles) et les intentions du groupe. Un non-membre d'une
-- communauté ou d'un groupe éphémère ne voit que nom, description, type, nombre de membres et date de fin.
-- Les intentions d'une personne que j'ai bloquée, ou qui m'a bloqué, ne me sont pas montrées.
-- Les tables ne sont pas lisibles directement (RLS sans politique, droits retirés) : tout passe par les fonctions ci-dessous.
--
-- can_see_profile (005, 007) est remplacée en bas du fichier : le profil et la vitrine s'ouvrent aussi entre deux
-- membres d'un même groupe, jamais en cas de blocage.
--
-- delete_my_account (004) : supprimer auth.users emporte group_members, group_requests, group_intentions (et par elles
--   group_carries, group_carry_counts), group_carries et group_reports de la personne par on delete cascade ;
--   groups.created_by passe à null. Le trigger group_members_after_delete réattribue la propriété si c'était un
--   propriétaire (plus ancien modérateur, sinon plus ancien membre) et supprime le groupe s'il n'a plus de membre.
--   daily_posts est vidé par delete_my_account. Rien à modifier.
-- adopt_account (002/003) : rien à changer. Une session anonyme n'est membre de rien et ne publie rien dans un groupe.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  kind text not null,
  invite_code text not null unique,
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint groups_name_len check (char_length(btrim(name)) between 3 and 60),
  constraint groups_description_len check (char_length(description) <= 280),
  constraint groups_kind check (kind in ('fraternite', 'communaute', 'ephemere')),
  constraint groups_ends_at check ((kind = 'ephemere') = (ends_at is not null)),
  constraint groups_invite_code_fmt check (invite_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$')
);

-- Recherche par nom : seuls les groupes trouvables (communautés et éphémères) sont indexés.
create index groups_name_idx on public.groups (lower(name) text_pattern_ops) where kind in ('communaute', 'ephemere');

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  constraint group_members_role check (role in ('owner', 'moderator', 'member'))
);

create index group_members_user_idx on public.group_members (user_id);
create unique index group_members_one_owner on public.group_members (group_id) where role = 'owner';

create table public.group_requests (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_requests_user_idx on public.group_requests (user_id);

create table public.group_intentions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  answered_at timestamptz,
  thanks text,
  withdrawn_at timestamptz,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint group_intentions_body_len check (char_length(body) between 1 and 280),
  constraint group_intentions_thanks_len check (thanks is null or char_length(thanks) <= 280)
);

create index group_intentions_group_idx on public.group_intentions (group_id, created_at desc) where withdrawn_at is null;
create index group_intentions_user_idx on public.group_intentions (user_id);

create table public.group_carries (
  user_id uuid not null references auth.users (id) on delete cascade,
  intention_id uuid not null references public.group_intentions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, intention_id)
);

create table public.group_carry_counts (
  intention_id uuid primary key references public.group_intentions (id) on delete cascade,
  count integer not null default 0
);

create table public.group_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  intention_id uuid not null references public.group_intentions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, intention_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_requests enable row level security;
alter table public.group_intentions enable row level security;
alter table public.group_carries enable row level security;
alter table public.group_carry_counts enable row level security;
alter table public.group_reports enable row level security;

revoke all on table public.groups from anon, authenticated;
revoke all on table public.group_members from anon, authenticated;
revoke all on table public.group_requests from anon, authenticated;
revoke all on table public.group_intentions from anon, authenticated;
revoke all on table public.group_carries from anon, authenticated;
revoke all on table public.group_carry_counts from anon, authenticated;
revoke all on table public.group_reports from anon, authenticated;

-- Les publications de groupe comptent dans la limite quotidienne, comme les échos, les intentions et le suivi.
-- On remplace la contrainte de 005 en gardant echo, intention et follow.
alter table public.daily_posts drop constraint if exists daily_posts_kind_check;
alter table public.daily_posts
  add constraint daily_posts_kind_check
  check (kind in ('echo', 'intention', 'follow', 'group', 'group_intention', 'code_try'));

-- ---------------------------------------------------------------------------------------------------------------
-- Aides internes : pas de droit d'exécution pour les clients.
-- ---------------------------------------------------------------------------------------------------------------

-- Utilisateur relié ET muni d'un profil, sinon 'auth' ou 'profil'.
create or replace function public.profile_uid()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_uid();
begin
  if not exists (select 1 from profiles p where p.id = uid) then
    raise exception 'profil';
  end if;
  return uid;
end;
$$;

create or replace function public.group_ended(p_ends_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_ends_at is not null and p_ends_at <= now();
$$;

-- Le rôle de p_user dans p_group, ou null s'il n'en est pas membre.
create or replace function public.group_role(p_group uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from group_members m where m.group_id = p_group and m.user_id = p_user;
$$;

-- Code d'invitation : 8 caractères pris dans 32 (ni 0, O, 1, I), tirés d'un uuid aléatoire du serveur.
create or replace function public.new_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  code text := '';
  i integer;
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, case when i < 6 then i else i + 4 end) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- Fait entrer p_user dans p_group (adhésion directe ou demande acceptée). Verrouille le groupe pour que la limite de
-- 200 membres tienne sous concurrence. p_self : le message de la limite des 20 groupes parle de « tu » ou de « cette personne ».
create or replace function public.add_group_member(p_group uuid, p_user uuid, p_self boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ends timestamptz;
begin
  select g.ends_at into ends from groups g where g.id = p_group for update;
  if not found then
    raise exception 'groupe_inconnu';
  end if;
  if exists (select 1 from group_members m where m.group_id = p_group and m.user_id = p_user) then
    delete from group_requests r where r.group_id = p_group and r.user_id = p_user;
    return;
  end if;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
  end if;
  if (select count(*) from group_members m where m.group_id = p_group) >= 200 then
    raise exception 'Ce groupe est complet';
  end if;
  if (select count(*) from group_members m where m.user_id = p_user) >= 20 then
    if p_self then
      raise exception 'Tu es déjà dans 20 groupes';
    end if;
    raise exception 'Cette personne est déjà dans 20 groupes';
  end if;
  insert into group_members (group_id, user_id, role) values (p_group, p_user, 'member');
  delete from group_requests r where r.group_id = p_group and r.user_id = p_user;
end;
$$;

-- Compteur « je la porte » des intentions de groupe, comme sync_carry_count (001).
create or replace function public.sync_group_carry_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into group_carry_counts (intention_id, count) values (new.intention_id, 1)
    on conflict (intention_id) do update set count = group_carry_counts.count + 1;
    return new;
  end if;
  update group_carry_counts set count = greatest(0, count - 1) where intention_id = old.intention_id;
  return old;
end;
$$;

create trigger group_carries_count
  after insert or delete on public.group_carries
  for each row execute function public.sync_group_carry_count();

-- Trois signalements masquent l'intention (comme hide_on_reports de 001).
create or replace function public.hide_group_intention_on_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*) into n from group_reports r where r.intention_id = new.intention_id;
  if n >= 3 then
    update group_intentions set hidden = true where id = new.intention_id;
  end if;
  return new;
end;
$$;

create trigger group_reports_hide
  after insert on public.group_reports
  for each row execute function public.hide_group_intention_on_reports();

-- Un membre part (il quitte, il est exclu, ou son compte est supprimé) :
--   - ses intentions de ce groupe sont retirées (un ancien membre ne reste pas lisible) ;
--   - si c'était le propriétaire, la propriété passe au plus ancien modérateur, sinon au plus ancien membre ;
--   - s'il ne reste personne, le groupe est supprimé.
-- Quand c'est la suppression du groupe qui emporte les membres, le groupe n'existe plus : rien à faire.
create or replace function public.group_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  successor uuid;
begin
  if not exists (select 1 from groups g where g.id = old.group_id) then
    return old;
  end if;
  update group_intentions set withdrawn_at = now()
  where group_id = old.group_id and user_id = old.user_id and withdrawn_at is null;
  if old.role = 'owner' then
    select m.user_id into successor
    from group_members m
    where m.group_id = old.group_id
    order by (m.role = 'moderator') desc, m.joined_at asc, m.user_id asc
    limit 1;
    if successor is null then
      delete from groups where id = old.group_id;
    else
      update group_members set role = 'owner' where group_id = old.group_id and user_id = successor;
    end if;
  end if;
  return old;
end;
$$;

create trigger group_members_after_delete
  after delete on public.group_members
  for each row execute function public.group_members_after_delete();

-- ---------------------------------------------------------------------------------------------------------------
-- Groupes : création, réglages, suppression
-- ---------------------------------------------------------------------------------------------------------------

-- Crée un groupe dont l'appelant est le propriétaire. Codes : nom_invalide, longueur, type_invalide, fin_invalide.
create or replace function public.create_group(p_name text, p_description text, p_kind text, p_ends_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  n text := btrim(coalesce(p_name, ''));
  d text := btrim(coalesce(p_description, ''));
  ends timestamptz := p_ends_at;
  gid uuid;
begin
  if char_length(n) < 3 or char_length(n) > 60 then
    raise exception 'nom_invalide';
  end if;
  if char_length(d) > 280 then
    raise exception 'longueur';
  end if;
  if p_kind is null or p_kind not in ('fraternite', 'communaute', 'ephemere') then
    raise exception 'type_invalide';
  end if;
  if p_kind = 'ephemere' then
    if ends is null or ends <= now() or ends > now() + interval '1 year' then
      raise exception 'fin_invalide';
    end if;
  else
    ends := null;
  end if;
  if (select count(*) from group_members m where m.user_id = uid) >= 20 then
    raise exception 'Tu es déjà dans 20 groupes';
  end if;
  if (
    select count(*) from daily_posts d
    where d.user_id = uid and d.kind = 'group' and d.created_at > now() - interval '1 day'
  ) >= 3 then
    raise exception 'Trop de groupes créés aujourd’hui';
  end if;

  loop
    begin
      insert into groups (name, description, kind, invite_code, ends_at, created_by)
      values (n, d, p_kind, public.new_invite_code(), ends, uid)
      returning id into gid;
      exit;
    exception when unique_violation then
      null; -- code déjà pris : on en tire un autre
    end;
  end loop;

  insert into group_members (group_id, user_id, role) values (gid, uid, 'owner');
  insert into daily_posts (user_id, kind) values (uid, 'group');
  return gid;
end;
$$;

-- Propriétaire seul : nom et description.
create or replace function public.update_group(p_id uuid, p_name text, p_description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
  n text := btrim(coalesce(p_name, ''));
  d text := btrim(coalesce(p_description, ''));
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r <> 'owner' then
    raise exception 'interdit';
  end if;
  if char_length(n) < 3 or char_length(n) > 60 then
    raise exception 'nom_invalide';
  end if;
  if char_length(d) > 280 then
    raise exception 'longueur';
  end if;
  update groups set name = n, description = d where id = p_id;
end;
$$;

-- Propriétaire seul. Emporte membres, demandes et intentions par on delete cascade.
create or replace function public.delete_group(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r <> 'owner' then
    raise exception 'interdit';
  end if;
  delete from groups where id = p_id;
end;
$$;

-- Propriétaire seul : un nouveau code, l'ancien (et son lien) ne marche plus.
create or replace function public.regenerate_invite(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
  code text;
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r <> 'owner' then
    raise exception 'interdit';
  end if;
  loop
    begin
      update groups set invite_code = public.new_invite_code() where id = p_id returning invite_code into code;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Lire les groupes
-- ---------------------------------------------------------------------------------------------------------------

-- Mes groupes, avec mon rôle, le nombre de membres et, pour un propriétaire ou un modérateur, les demandes en attente.
create or replace function public.my_groups()
returns table (
  id uuid,
  name text,
  description text,
  kind text,
  ends_at timestamptz,
  ended boolean,
  role text,
  member_count integer,
  pending_requests integer
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
    g.name,
    g.description,
    g.kind,
    g.ends_at,
    public.group_ended(g.ends_at),
    m.role,
    (select count(*)::integer from group_members x where x.group_id = g.id),
    case when m.role in ('owner', 'moderator')
      then (select count(*)::integer from group_requests r where r.group_id = g.id)
      else 0
    end
  from group_members m
  join groups g on g.id = m.group_id
  where m.user_id = uid
  order by public.group_ended(g.ends_at), lower(g.name), g.id;
end;
$$;

-- Le détail d'un groupe. Un membre voit tout, dont le code d'invitation. Un non-membre ne reçoit qu'une carte minimale
-- (nom, description, type, nombre de membres, fin), et seulement pour une communauté ou un groupe éphémère :
-- une fraternité est introuvable pour qui n'en est pas membre. my_status : member, requested ou none.
create or replace function public.get_group(p_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  kind text,
  ends_at timestamptz,
  ended boolean,
  member_count integer,
  my_status text,
  my_role text,
  invite_code text,
  pending_requests integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
begin
  return query
  select
    g.id,
    g.name,
    g.description,
    g.kind,
    g.ends_at,
    public.group_ended(g.ends_at),
    (select count(*)::integer from group_members x where x.group_id = g.id),
    case
      when r is not null then 'member'
      when exists (select 1 from group_requests q where q.group_id = g.id and q.user_id = uid) then 'requested'
      else 'none'
    end,
    r,
    case when r is not null then g.invite_code end,
    case when r in ('owner', 'moderator')
      then (select count(*)::integer from group_requests q where q.group_id = g.id)
      else 0
    end
  from groups g
  where g.id = p_id and (r is not null or g.kind <> 'fraternite');
end;
$$;

-- La carte d'un groupe pour l'écran d'invitation. Un code inconnu ne renvoie rien et compte comme un essai raté
-- (30 par jour) pour qu'on ne puisse pas deviner un code.
create or replace function public.group_by_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  kind text,
  ends_at timestamptz,
  ended boolean,
  member_count integer,
  is_full boolean,
  my_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  gid uuid;
begin
  if (
    select count(*) from daily_posts d
    where d.user_id = uid and d.kind = 'code_try' and d.created_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'Trop d’essais de code pour aujourd’hui';
  end if;
  select g.id into gid from groups g where g.invite_code = code;
  if gid is null then
    insert into daily_posts (user_id, kind) values (uid, 'code_try');
    return;
  end if;
  return query
  select
    g.id,
    g.name,
    g.description,
    g.kind,
    g.ends_at,
    public.group_ended(g.ends_at),
    (select count(*)::integer from group_members x where x.group_id = g.id),
    (select count(*) from group_members x where x.group_id = g.id) >= 200,
    case
      when exists (select 1 from group_members x where x.group_id = g.id and x.user_id = uid) then 'member'
      when exists (select 1 from group_requests q where q.group_id = g.id and q.user_id = uid) then 'requested'
      else 'none'
    end
  from groups g
  where g.id = gid;
end;
$$;

-- Recherche par nom (2 caractères au moins, 20 résultats) parmi les communautés et les groupes éphémères non terminés.
-- Les fraternités n'y sont jamais.
create or replace function public.search_groups(p_query text)
returns table (
  id uuid,
  name text,
  description text,
  kind text,
  ends_at timestamptz,
  member_count integer,
  my_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  q text := lower(btrim(coalesce(p_query, '')));
begin
  if char_length(q) < 2 then
    raise exception 'recherche';
  end if;
  return query
  select
    g.id,
    g.name,
    g.description,
    g.kind,
    g.ends_at,
    (select count(*)::integer from group_members x where x.group_id = g.id),
    case
      when exists (select 1 from group_members x where x.group_id = g.id and x.user_id = uid) then 'member'
      when exists (select 1 from group_requests y where y.group_id = g.id and y.user_id = uid) then 'requested'
      else 'none'
    end
  from groups g
  where g.kind in ('communaute', 'ephemere')
    and not public.group_ended(g.ends_at)
    and position(q in lower(g.name)) > 0
  order by starts_with(lower(g.name), q) desc, lower(g.name), g.id
  limit 20;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Entrer, demander, quitter
-- ---------------------------------------------------------------------------------------------------------------

-- Entre dans le groupe qui porte ce code (adhésion immédiate, quel que soit le type). Renvoie son identifiant,
-- ou null si le code est inconnu (compté comme un essai raté). Déjà membre : renvoie l'identifiant sans rien changer.
create or replace function public.join_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  gid uuid;
begin
  if (
    select count(*) from daily_posts d
    where d.user_id = uid and d.kind = 'code_try' and d.created_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'Trop d’essais de code pour aujourd’hui';
  end if;
  select g.id into gid from groups g where g.invite_code = code;
  if gid is null then
    insert into daily_posts (user_id, kind) values (uid, 'code_try');
    return null;
  end if;
  perform public.add_group_member(gid, uid, true);
  return gid;
end;
$$;

-- Groupe éphémère trouvé par la recherche : adhésion immédiate. Les autres types passent par request_join ou le code.
create or replace function public.join_group(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  k text;
begin
  select g.kind into k from groups g where g.id = p_id;
  if k is null or k = 'fraternite' then
    raise exception 'groupe_inconnu';
  end if;
  if k <> 'ephemere' then
    raise exception 'pas_ephemere';
  end if;
  perform public.add_group_member(p_id, uid, true);
end;
$$;

-- Demande à rejoindre une communauté. 20 demandes en attente au plus par personne.
create or replace function public.request_join(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  k text;
begin
  select g.kind into k from groups g where g.id = p_id;
  if k is null or k = 'fraternite' then
    raise exception 'groupe_inconnu';
  end if;
  if k <> 'communaute' then
    raise exception 'pas_de_demande';
  end if;
  if exists (select 1 from group_members m where m.group_id = p_id and m.user_id = uid) then
    return;
  end if;
  if exists (select 1 from group_requests r where r.group_id = p_id and r.user_id = uid) then
    return;
  end if;
  if (select count(*) from group_members m where m.group_id = p_id) >= 200 then
    raise exception 'Ce groupe est complet';
  end if;
  if (select count(*) from group_members m where m.user_id = uid) >= 20 then
    raise exception 'Tu es déjà dans 20 groupes';
  end if;
  if (select count(*) from group_requests r where r.user_id = uid) >= 20 then
    raise exception 'Tu as déjà 20 demandes en attente';
  end if;
  insert into group_requests (group_id, user_id) values (p_id, uid);
end;
$$;

create or replace function public.cancel_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
begin
  delete from group_requests r where r.group_id = p_id and r.user_id = uid;
end;
$$;

-- Propriétaire ou modérateur : les demandes en attente.
create or replace function public.list_requests(p_id uuid)
returns table (handle text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
begin
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  return query
  select p.handle, q.created_at
  from group_requests q
  join profiles p on p.id = q.user_id
  where q.group_id = p_id
  order by q.created_at asc
  limit 200;
end;
$$;

-- Propriétaire ou modérateur : accepte (le groupe ne doit être ni terminé ni complet) ou refuse une demande.
create or replace function public.answer_request(p_id uuid, p_handle text, p_accept boolean)
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
  select q.user_id into target
  from group_requests q
  join profiles p on p.id = q.user_id
  where q.group_id = p_id and p.handle = h;
  if target is null then
    raise exception 'cible';
  end if;
  if p_accept is true then
    perform public.add_group_member(p_id, target, false);
  else
    delete from group_requests q where q.group_id = p_id and q.user_id = target;
  end if;
end;
$$;

-- Les membres, pour un membre seulement : pseudo, rôle, et si c'est moi. Propriétaire d'abord, puis modérateurs.
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
  select p.handle, m.role, m.joined_at, m.user_id = uid
  from group_members m
  join profiles p on p.id = m.user_id
  where m.group_id = p_id
  order by case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end, m.joined_at asc, p.handle asc
  limit 200;
end;
$$;

-- Propriétaire seul : nomme (moderator) ou retire (member) un modérateur. Jamais le propriétaire.
create or replace function public.set_role(p_id uuid, p_handle text, p_role text)
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
  if r <> 'owner' then
    raise exception 'interdit';
  end if;
  if p_role is null or p_role not in ('moderator', 'member') then
    raise exception 'role_invalide';
  end if;
  select p.id into target from profiles p where p.handle = h;
  target_role := public.group_role(p_id, target);
  if target is null or target_role is null then
    raise exception 'cible';
  end if;
  if target_role = 'owner' then
    raise exception 'proprio';
  end if;
  update group_members set role = p_role where group_id = p_id and user_id = target;
end;
$$;

-- Propriétaire seul : donne la propriété à un autre membre ; l'ancien propriétaire devient modérateur.
create or replace function public.transfer_ownership(p_id uuid, p_handle text)
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
  if r <> 'owner' then
    raise exception 'interdit';
  end if;
  select p.id into target from profiles p where p.handle = h;
  if target is null or public.group_role(p_id, target) is null then
    raise exception 'cible';
  end if;
  if target = uid then
    raise exception 'proprio';
  end if;
  update group_members set role = 'moderator' where group_id = p_id and user_id = uid;
  update group_members set role = 'owner' where group_id = p_id and user_id = target;
end;
$$;

-- Propriétaire ou modérateur : exclut un membre. Jamais le propriétaire, jamais soi-même (on quitte), et un
-- modérateur n'exclut pas un modérateur.
create or replace function public.remove_member(p_id uuid, p_handle text)
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
  delete from group_members where group_id = p_id and user_id = target;
end;
$$;

-- Tout membre quitte, sauf le propriétaire, qui transfère d'abord (ou supprime le groupe).
create or replace function public.leave_group(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  r text := public.group_role(p_id, uid);
begin
  if r is null then
    return;
  end if;
  if r = 'owner' then
    raise exception 'Tu es le propriétaire : transfère d’abord le groupe à un autre membre, ou supprime-le.';
  end if;
  delete from group_members where group_id = p_id and user_id = uid;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Intentions de groupe
-- ---------------------------------------------------------------------------------------------------------------

-- Les 50 dernières intentions non retirées, pour un membre. Les intentions masquées (3 signalements) ne sont vues que
-- par leur auteur ; celles d'une personne bloquée (dans un sens ou l'autre) ne sont jamais montrées.
create or replace function public.list_group_intentions(p_id uuid)
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
  hidden boolean
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
    i.hidden
  from group_intentions i
  left join profiles p on p.id = i.user_id
  left join group_carry_counts c on c.intention_id = i.id
  where i.group_id = p_id
    and i.withdrawn_at is null
    and (not i.hidden or i.user_id = uid)
    and not public.is_blocked(uid, i.user_id)
  order by i.created_at desc
  limit 50;
end;
$$;

-- Un membre écrit une intention (1 à 280 caractères, 10 par jour). Refusé quand le groupe est terminé.
create or replace function public.post_group_intention(p_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  clean text := btrim(coalesce(p_body, ''));
  ends timestamptz;
  new_id uuid;
begin
  if public.group_role(p_id, uid) is null then
    raise exception 'groupe_inconnu';
  end if;
  select g.ends_at into ends from groups g where g.id = p_id;
  if public.group_ended(ends) then
    raise exception 'Ce groupe est terminé';
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
  insert into group_intentions (group_id, user_id, body) values (p_id, uid, clean) returning id into new_id;
  insert into daily_posts (user_id, kind) values (uid, 'group_intention');
  return new_id;
end;
$$;

-- L'auteur retire son intention.
create or replace function public.withdraw_group_intention(p_intention_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
begin
  update group_intentions set withdrawn_at = now()
  where id = p_intention_id and user_id = uid and withdrawn_at is null;
end;
$$;

-- L'auteur (encore membre) marque son intention exaucée, avec un mot d'action de grâce facultatif (280 au plus).
-- On peut rappeler la fonction pour changer le mot.
create or replace function public.mark_answered(p_intention_id uuid, p_thanks text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  t text := nullif(btrim(coalesce(p_thanks, '')), '');
  gid uuid;
begin
  if char_length(coalesce(t, '')) > 280 then
    raise exception 'longueur';
  end if;
  select i.group_id into gid
  from group_intentions i
  where i.id = p_intention_id and i.user_id = uid and i.withdrawn_at is null;
  if gid is null then
    raise exception 'intention_inconnue';
  end if;
  if public.group_role(gid, uid) is null then
    raise exception 'groupe_inconnu';
  end if;
  update group_intentions set answered_at = coalesce(answered_at, now()), thanks = t where id = p_intention_id;
end;
$$;

-- Aide commune : une intention que le membre appelant peut voir (membre du groupe, non retirée, non masquée,
-- auteur non bloqué dans un sens ou l'autre). Renvoie l'auteur et le groupe, ou lève intention_inconnue.
create or replace function public.visible_group_intention(p_intention_id uuid, p_viewer uuid)
returns table (author uuid, group_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select i.user_id, i.group_id
  from group_intentions i
  where i.id = p_intention_id
    and i.withdrawn_at is null
    and not i.hidden
    and exists (select 1 from group_members m where m.group_id = i.group_id and m.user_id = p_viewer)
    and not public.is_blocked(p_viewer, i.user_id);
  if not found then
    raise exception 'intention_inconnue';
  end if;
end;
$$;

-- « Je la porte » : un membre porte l'intention d'un autre (pas la sienne).
create or replace function public.set_group_carry(p_intention_id uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  author uuid;
begin
  select v.author into author from public.visible_group_intention(p_intention_id, uid) v;
  if author = uid then
    raise exception 'ta_intention';
  end if;
  if p_on is true then
    insert into group_carries (user_id, intention_id) values (uid, p_intention_id) on conflict do nothing;
  else
    delete from group_carries k where k.user_id = uid and k.intention_id = p_intention_id;
  end if;
end;
$$;

-- Un membre signale l'intention d'un autre ; trois signalements la masquent.
create or replace function public.report_group_intention(p_intention_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.profile_uid();
  author uuid;
begin
  select v.author into author from public.visible_group_intention(p_intention_id, uid) v;
  if author = uid then
    raise exception 'ta_intention';
  end if;
  insert into group_reports (user_id, intention_id) values (uid, p_intention_id);
exception
  when unique_violation then
    raise exception 'Déjà signalé';
end;
$$;

-- Modération : propriétaire ou modérateur retire l'intention d'un membre (la sienne aussi).
create or replace function public.remove_group_intention(p_intention_id uuid)
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
  select i.group_id into gid from group_intentions i where i.id = p_intention_id and i.withdrawn_at is null;
  if gid is null then
    raise exception 'intention_inconnue';
  end if;
  r := public.group_role(gid, uid);
  if r is null then
    raise exception 'groupe_inconnu';
  end if;
  if r not in ('owner', 'moderator') then
    raise exception 'interdit';
  end if;
  update group_intentions set withdrawn_at = now() where id = p_intention_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Visibilité des profils
-- ---------------------------------------------------------------------------------------------------------------

-- Remplace la version de 007. Le profil complet (et la vitrine, qui suit cette fonction) de p_owner est visible par
-- p_viewer s'il est le propriétaire, si le propriétaire suit p_viewer, ou si tous deux sont membres d'un même groupe.
-- Toujours faux dès que l'un a bloqué l'autre. Interne : pas de droit d'exécution pour les clients.
create or replace function public.can_see_profile(p_viewer uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_viewer is not null and p_owner is not null and (
    p_viewer = p_owner
    or (
      not public.is_blocked(p_viewer, p_owner)
      and (
        exists (select 1 from follows f where f.follower_id = p_owner and f.followee_id = p_viewer)
        or exists (
          select 1
          from group_members a
          join group_members b on b.group_id = a.group_id
          where a.user_id = p_viewer and b.user_id = p_owner
        )
      )
    )
  );
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function public.profile_uid() from public, anon, authenticated;
revoke all on function public.group_ended(timestamptz) from public, anon, authenticated;
revoke all on function public.group_role(uuid, uuid) from public, anon, authenticated;
revoke all on function public.new_invite_code() from public, anon, authenticated;
revoke all on function public.add_group_member(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.sync_group_carry_count() from public, anon, authenticated;
revoke all on function public.hide_group_intention_on_reports() from public, anon, authenticated;
revoke all on function public.group_members_after_delete() from public, anon, authenticated;
revoke all on function public.visible_group_intention(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_see_profile(uuid, uuid) from public, anon, authenticated;

revoke all on function public.create_group(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.update_group(uuid, text, text) from public, anon, authenticated;
revoke all on function public.delete_group(uuid) from public, anon, authenticated;
revoke all on function public.regenerate_invite(uuid) from public, anon, authenticated;
revoke all on function public.my_groups() from public, anon, authenticated;
revoke all on function public.get_group(uuid) from public, anon, authenticated;
revoke all on function public.group_by_code(text) from public, anon, authenticated;
revoke all on function public.search_groups(text) from public, anon, authenticated;
revoke all on function public.join_by_code(text) from public, anon, authenticated;
revoke all on function public.join_group(uuid) from public, anon, authenticated;
revoke all on function public.request_join(uuid) from public, anon, authenticated;
revoke all on function public.cancel_request(uuid) from public, anon, authenticated;
revoke all on function public.list_requests(uuid) from public, anon, authenticated;
revoke all on function public.answer_request(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.list_members(uuid) from public, anon, authenticated;
revoke all on function public.set_role(uuid, text, text) from public, anon, authenticated;
revoke all on function public.transfer_ownership(uuid, text) from public, anon, authenticated;
revoke all on function public.remove_member(uuid, text) from public, anon, authenticated;
revoke all on function public.leave_group(uuid) from public, anon, authenticated;
revoke all on function public.list_group_intentions(uuid) from public, anon, authenticated;
revoke all on function public.post_group_intention(uuid, text) from public, anon, authenticated;
revoke all on function public.withdraw_group_intention(uuid) from public, anon, authenticated;
revoke all on function public.mark_answered(uuid, text) from public, anon, authenticated;
revoke all on function public.set_group_carry(uuid, boolean) from public, anon, authenticated;
revoke all on function public.report_group_intention(uuid) from public, anon, authenticated;
revoke all on function public.remove_group_intention(uuid) from public, anon, authenticated;

grant execute on function public.create_group(text, text, text, timestamptz) to authenticated;
grant execute on function public.update_group(uuid, text, text) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.get_group(uuid) to authenticated;
grant execute on function public.group_by_code(text) to authenticated;
grant execute on function public.search_groups(text) to authenticated;
grant execute on function public.join_by_code(text) to authenticated;
grant execute on function public.join_group(uuid) to authenticated;
grant execute on function public.request_join(uuid) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;
grant execute on function public.list_requests(uuid) to authenticated;
grant execute on function public.answer_request(uuid, text, boolean) to authenticated;
grant execute on function public.list_members(uuid) to authenticated;
grant execute on function public.set_role(uuid, text, text) to authenticated;
grant execute on function public.transfer_ownership(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.list_group_intentions(uuid) to authenticated;
grant execute on function public.post_group_intention(uuid, text) to authenticated;
grant execute on function public.withdraw_group_intention(uuid) to authenticated;
grant execute on function public.mark_answered(uuid, text) to authenticated;
grant execute on function public.set_group_carry(uuid, boolean) to authenticated;
grant execute on function public.report_group_intention(uuid) to authenticated;
grant execute on function public.remove_group_intention(uuid) to authenticated;
