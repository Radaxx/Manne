-- Un compte suspendu ne publie plus mais lit encore ; un banni ne rejoint pas son groupe ; le filtre de mots refuse un mot
-- interdit et laisse passer le vocabulaire chrétien.
-- Lancer : supabase test db   (base locale ; tout est annulé à la fin).
begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

-- alice : propriétaire des groupes ; bob : membre ; carol : publie ; evil : suspendu ; mod : modératrice éditeur.
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'alice@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bob@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'carol@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'mod@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'evil@test.invalid', false);
insert into public.profiles (id, handle, display_name, charter_accepted_at) values
  ('a0000000-0000-0000-0000-000000000001', 'test_alice', 'test_alice', now()),
  ('a0000000-0000-0000-0000-000000000002', 'test_bob', 'test_bob', now()),
  ('a0000000-0000-0000-0000-000000000003', 'test_carol', 'test_carol', now()),
  ('a0000000-0000-0000-0000-000000000004', 'test_mod', 'test_mod', now()),
  ('a0000000-0000-0000-0000-000000000005', 'test_evil', 'test_evil', now());
insert into public.app_moderators (user_id) values ('a0000000-0000-0000-0000-000000000004');
insert into public.groups (id, name, kind, invite_code, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'Groupe de test', 'communaute', 'ABCDEFGH', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Autre groupe', 'communaute', 'JKLMNPQR', 'a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'member'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'owner');
insert into public.intentions (id, user_id, body) values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Une intention du fil');
insert into public.echoes (user_id, target, body) values
  ('a0000000-0000-0000-0000-000000000002', '1:1:1-1', 'Un écho');

-- 1. Un compte suspendu (sept jours) ne publie plus rien.
insert into public.account_suspensions (user_id, until, reason, suspended_by) values
  ('a0000000-0000-0000-0000-000000000005', now() + interval '7 days', 'Propos blessants', 'a0000000-0000-0000-0000-000000000004');

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select throws_ok($$select public.post_echo('1:1:9-9', 'Bonjour')$$, 'P0001', 'compte_suspendu', 'suspendu : pas d''écho');
select throws_ok($$select public.post_intention('Bonjour')$$, 'P0001', 'compte_suspendu', 'suspendu : pas d''intention du fil');
select throws_ok($$select public.save_my_profile('test_evil', 'test_evil', 'Nouvelle bio', null, true)$$, 'P0001', 'compte_suspendu',
  'suspendu : pas de nouvelle bio');
select throws_ok($$select public.follow('test_bob')$$, 'P0001', 'compte_suspendu', 'suspendu : ne suit personne');
select throws_ok($$select public.create_group('Mon groupe à moi', '', 'communaute', null)$$, 'P0001', 'compte_suspendu',
  'suspendu : ne crée pas de groupe');
select throws_ok($$select public.post_group_intention('b0000000-0000-0000-0000-000000000001', 'Bonjour')$$, 'P0001', 'compte_suspendu',
  'suspendu : pas d''intention de groupe');
select throws_ok($$select public.request_join('b0000000-0000-0000-0000-000000000002')$$, 'P0001', 'compte_suspendu',
  'suspendu : ne demande pas à rejoindre un groupe');
select throws_ok($$select public.join_by_code('JKLMNPQR')$$, 'P0001', 'compte_suspendu', 'suspendu : ne rejoint pas avec un code');
select throws_ok($$select public.show_prayer('mes-prieres', 'Titre', 'Texte')$$, 'P0001', 'compte_suspendu',
  'suspendu : n''affiche pas de prière sur son profil');

-- Il lit, prie, porte, aime, regarde sa suspension et peut supprimer son compte.
select lives_ok($$select * from public.list_intentions()$$, 'suspendu : lit le fil des intentions');
select lives_ok($$select * from public.list_echoes('1:1:1-1')$$, 'suspendu : lit les échos');
select lives_ok($$select * from public.list_group_intentions('b0000000-0000-0000-0000-000000000001')$$, 'suspendu : lit son groupe');
select lives_ok($$select * from public.get_my_profile()$$, 'suspendu : lit son profil');
select lives_ok($$select public.set_carry('f0000000-0000-0000-0000-000000000001', true)$$, 'suspendu : porte encore une intention');
select lives_ok($$insert into public.likes (user_id, target) values (auth.uid(), '1:1:1-1')$$, 'suspendu : aime encore un passage');
select is((select reason from public.my_suspension()), 'Propos blessants', 'my_suspension donne le motif');
select ok((select until from public.my_suspension()) > now() + interval '6 days', 'my_suspension donne la fin');
select is(public.am_i_app_moderator(), false, 'suspendu : pas modérateur');

-- 2. Une suspension échue ne bloque plus ; sans fin (until nul), elle bloque.
reset role;
update public.account_suspensions set until = now() - interval '1 minute' where user_id = 'a0000000-0000-0000-0000-000000000005';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select is((select count(*)::int from public.my_suspension()), 0, 'une suspension échue ne s''affiche plus');
select lives_ok($$select public.post_echo('1:1:9-9', 'Bonjour')$$, 'une suspension échue ne bloque plus');
reset role;
update public.account_suspensions set until = null where user_id = 'a0000000-0000-0000-0000-000000000005';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select throws_ok($$select public.post_intention('Bonjour')$$, 'P0001', 'compte_suspendu', 'sans fin : bloqué');
select is((select until from public.my_suspension()), null, 'sans fin : until est nul');

-- 3. La modératrice lève la suspension : il publie de nouveau.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.mod_unsuspend('test_evil')$$, 'mod lève la suspension');
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.post_intention('Bonjour')$$, 'levée : il publie de nouveau');

-- 4. Un compte suspendu supprime son compte sans obstacle.
reset role;
insert into public.account_suspensions (user_id, until, reason) values
  ('a0000000-0000-0000-0000-000000000005', null, 'Récidive');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.delete_my_account()$$, 'suspendu : supprime son compte');
reset role;
select is((select count(*)::int from public.account_suspensions where user_id = 'a0000000-0000-0000-0000-000000000005'), 0,
  'sa suspension disparaît avec son compte');

-- 5. Un banni ne rejoint pas le groupe, ni par demande ni par code ; levé, il peut de nouveau.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.ban_member('b0000000-0000-0000-0000-000000000001', 'test_bob')$$, 'alice bannit bob');
reset role;
select is((select count(*)::int from public.group_members where group_id = 'b0000000-0000-0000-0000-000000000001'
  and user_id = 'a0000000-0000-0000-0000-000000000002'), 0, 'le banni est exclu du groupe');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select throws_ok($$select public.request_join('b0000000-0000-0000-0000-000000000001')$$, 'P0001', 'Tu ne peux pas rejoindre ce groupe.',
  'un banni ne demande pas à rejoindre');
select throws_ok($$select public.join_by_code('ABCDEFGH')$$, 'P0001', 'Tu ne peux pas rejoindre ce groupe.',
  'un banni ne rejoint pas avec le code');
select lives_ok($$select public.request_join('b0000000-0000-0000-0000-000000000002')$$, 'un banni rejoint les autres groupes');
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.unban_member('b0000000-0000-0000-0000-000000000001', 'test_bob')$$, 'alice lève le bannissement');
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.join_by_code('ABCDEFGH')$$, 'bannissement levé : il rejoint avec le code');

-- 6. Le filtre refuse un mot interdit (et ses déguisements simples), pas le vocabulaire chrétien.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select throws_ok($$select public.post_echo('1:1:1-1', 'Quel connard')$$, 'P0001', 'contenu_refuse', 'le filtre refuse un mot interdit');
select throws_ok($$select public.post_echo('1:1:1-1', 'Quel C0NNARD !')$$, 'P0001', 'contenu_refuse', 'le filtre refuse un mot déguisé');
select throws_ok($$select public.post_intention('Va te faire foutre')$$, 'P0001', 'contenu_refuse', 'le filtre refuse une expression');
select throws_ok($$select public.save_my_profile('test_carol', 'test_carol', 'Quelle merde', null, true)$$, 'P0001', 'contenu_refuse',
  'le filtre refuse une bio');
select throws_ok($$select public.create_group('Les connards', '', 'communaute', null)$$, 'P0001', 'contenu_refuse',
  'le filtre refuse un nom de groupe');
select lives_ok($$select public.post_intention('Contre l’enfer, le démon, le péché')$$, 'le filtre laisse « l’enfer, le démon, le péché »');
select lives_ok($$select public.post_echo('1:1:1-1', 'L’enfer, le démon, le péché : délivre-nous, Seigneur.')$$, 'idem pour un écho');
reset role;
select is((select count(*)::int from public.echoes where user_id = 'a0000000-0000-0000-0000-000000000003' and body ~ 'connard'), 0,
  'un texte refusé n''est pas enregistré');
select is((select count(*)::int from public.intentions where user_id = 'a0000000-0000-0000-0000-000000000003'), 1,
  'seule l''intention acceptée est enregistrée');

select * from finish();
rollback;
