-- Le profil n'a plus que le pseudo.
-- `display_name` est gardée pour ne pas réécrire les fonctions de 005 : elle vaut toujours le pseudo.

create or replace function public.profiles_display_name_is_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.display_name := new.handle;
  return new;
end;
$$;

revoke all on function public.profiles_display_name_is_handle() from public, anon, authenticated;

drop trigger if exists profiles_display_name_is_handle on public.profiles;
create trigger profiles_display_name_is_handle
  before insert or update on public.profiles
  for each row execute function public.profiles_display_name_is_handle();

update public.profiles set display_name = handle where display_name is distinct from handle;
