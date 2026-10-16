-- Suppression du compte (exigée par l'App Store) : l'utilisateur efface son propre compte depuis l'app.
-- Supprimer la ligne auth.users emporte, par on delete cascade :
--   user_state (progression synchronisée), likes (leurs compteurs baissent via le trigger),
--   echoes, intentions (et, par elles, les carries et carry_counts qui s'y rattachent),
--   carries (ce que l'utilisateur portait), reports (ses signalements, et ceux visant ses écrits),
--   account_adoptions.
-- daily_posts n'a pas de clé étrangère (il compte les publications même supprimées) : on le vide ici.

create or replace function public.delete_my_account()
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
  delete from daily_posts where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
