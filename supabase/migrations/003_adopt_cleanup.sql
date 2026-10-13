-- Adoption d'une session anonyme : après fusion, le compte ne doit ni porter ses propres intentions
-- ni garder des signalements visant ses propres écrits (l'anonyme avait pu porter ou signaler ceux du compte).
-- Même corps que 002, plus le nettoyage final. Les droits d'exécution de la fonction sont conservés.

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

  delete from user_state where user_id = src;
  delete from account_adoptions where nonce = p_nonce;
end;
$$;
