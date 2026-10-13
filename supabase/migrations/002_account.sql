-- Compte : progression synchronisée, et adoption d'une session anonyme déjà utilisée.
-- Dans Authentication > Settings, activer « Manual linking ».
-- Redirect URLs : manne://auth/callback
-- Apple et Google : les activer dans Authentication > Providers. Sur iOS, Apple est requis si Google l'est.

create table public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Nonce à courte durée, déposé par l'anonyme avant de se connecter à un compte qui existe déjà.
create table public.account_adoptions (
  nonce uuid primary key,
  from_user uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.user_state enable row level security;
alter table public.account_adoptions enable row level security;

create policy user_state_own on public.user_state
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy account_adoptions_insert_own on public.account_adoptions
  for insert to authenticated
  with check (from_user = auth.uid());

revoke all on table public.user_state from anon, authenticated;
revoke all on table public.account_adoptions from anon, authenticated;

grant select, insert, update on table public.user_state to authenticated;
grant insert on table public.account_adoptions to authenticated;

-- Déplace les écrits communautaires de l'anonyme vers le compte qui présente le nonce.
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

  update daily_posts set user_id = uid where user_id = src;

  delete from user_state where user_id = src;
  delete from account_adoptions where nonce = p_nonce;
end;
$$;

revoke all on function public.adopt_account(uuid) from public, anon, authenticated;
grant execute on function public.adopt_account(uuid) to authenticated;
