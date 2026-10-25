-- Retours des testeurs (019) : envoi par toute session, limites, lecture et classement réservés aux modérateurs éditeur,
-- table illisible directement, suppression avec le compte.
-- Lancer : supabase test db   (base locale ; tout est annulé à la fin).
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- 1 : compte relié avec profil ; 2 : anonyme ; 3 : modérateur éditeur.
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('d0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'tester@test.invalid', false),
  ('d0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', null, true),
  ('d0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'mod@test.invalid', false);
insert into public.profiles (id, handle, display_name, charter_accepted_at) values
  ('d0000000-0000-0000-0000-000000000001', 'test_tester', 'test_tester', now()),
  ('d0000000-0000-0000-0000-000000000003', 'test_fbmod', 'test_fbmod', now());
insert into public.app_moderators (user_id) values ('d0000000-0000-0000-0000-000000000003');

-- 1..2. Un compte relié envoie un retour ; les champs vides deviennent nuls.
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.send_feedback('bug', '  Le chapelet se fige  ', '  ', '1.5.2', 'android', '35')$$,
  'compte relié : retour envoyé');
reset role;
select results_eq(
  $$select body, contact, app_version, platform, os_version from public.feedback
    where user_id = 'd0000000-0000-0000-0000-000000000001'$$,
  $$values ('Le chapelet se fige'::text, null::text, '1.5.2'::text, 'android'::text, '35'::text)$$,
  'message rogné, adresse vide nulle'
);

-- 3. Une session anonyme envoie aussi.
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select lives_ok($$select public.send_feedback('idee', 'Une idée', 'anon@test.invalid')$$, 'anonyme : retour envoyé');

-- 4..6. Type, message vide, longueur.
select throws_ok($$select public.send_feedback('plainte', 'x')$$, 'P0001', 'kind_invalide', 'type inconnu refusé');
select throws_ok($$select public.send_feedback('bug', '   ')$$, 'P0001', 'retour_vide', 'message vide refusé');
select throws_ok($$select public.send_feedback('bug', repeat('a', 2001))$$, 'P0001', 'longueur', 'message trop long refusé');

-- 7. Pas de lecture directe de la table.
select throws_ok($$select * from public.feedback$$, '42501', null, 'table illisible directement');

-- 8. Pas d'accès à la file des retours.
select throws_ok($$select * from public.mod_feedback()$$, 'P0001', 'interdit', 'non-modérateur : file refusée');

-- 9. Limite : 5 retours par tranche de 10 minutes (l'anonyme en a déjà envoyé un).
select lives_ok($$select public.send_feedback('autre', 'deux'); select public.send_feedback('autre', 'trois');
  select public.send_feedback('autre', 'quatre'); select public.send_feedback('autre', 'cinq')$$, 'cinq retours acceptés');
select throws_ok($$select public.send_feedback('autre', 'six')$$, 'P0001', 'trop_de_retours', 'sixième retour refusé');

-- 11..13. Le modérateur lit les retours avec le pseudo de l'auteur, et en classe un.
reset role;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select is((select count(*)::int from public.mod_feedback()), 6, 'modérateur : tous les retours');
select results_eq(
  $$select handle, anonymous from public.mod_feedback() where kind = 'bug'$$,
  $$values ('test_tester'::text, false)$$,
  'auteur désigné par son pseudo'
);
select lives_ok(
  $$select public.mod_resolve_feedback((select id from public.mod_feedback() where kind = 'bug'))$$,
  'modérateur : retour classé'
);
select isnt((select resolved_at from public.mod_feedback() where kind = 'bug'), null, 'retour marqué comme lu');

-- 15. Supprimer le compte efface ses retours.
reset role;
delete from auth.users where id = 'd0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.feedback where user_id = 'd0000000-0000-0000-0000-000000000001'), 0,
  'compte supprimé : retours effacés');

select * from finish();
rollback;
