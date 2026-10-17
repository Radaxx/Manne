-- Règles d'accès : aucune table de contenu n'est lisible directement, une session anonyme ne crée ni profil ni groupe,
-- un non-membre ne lit pas un groupe, un membre ne lit pas la file de signalements, les fonctions mod_* refusent un
-- non-modérateur. Les rôles sont simulés comme le fait Supabase : set local role + request.jwt.claims.
-- Lancer : supabase test db   (base locale ; tout est annulé à la fin).
begin;

create extension if not exists pgtap with schema extensions;

select plan(106);

-- Personnes : alice (propriétaire du groupe), bob (membre), carol (étrangère), mod (modératrice éditeur), anon (session
-- anonyme), anonmod (session anonyme inscrite par erreur comme modératrice).
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'alice@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bob@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'carol@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'mod@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', null, true),
  ('a0000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', null, true);
insert into public.profiles (id, handle, display_name, charter_accepted_at) values
  ('a0000000-0000-0000-0000-000000000001', 'test_alice', 'test_alice', now()),
  ('a0000000-0000-0000-0000-000000000002', 'test_bob', 'test_bob', now()),
  ('a0000000-0000-0000-0000-000000000003', 'test_carol', 'test_carol', now()),
  ('a0000000-0000-0000-0000-000000000004', 'test_mod', 'test_mod', now());
insert into public.groups (id, name, kind, invite_code, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'Groupe de test', 'communaute', 'ABCDEFGH', 'a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member');
insert into public.group_intentions (id, group_id, user_id, body) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Pour la paix');
insert into public.app_moderators (user_id) values
  ('a0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000008');

-- 1. Aucune table de contenu n'est lisible directement, ni par anon ni par authenticated (likes : les siens seulement).
set local role anon;
select throws_ok(format('select 1 from public.%I', t), '42501', null, 'anon ne lit pas ' || t)
from unnest(array[
  'echoes', 'intentions', 'carries', 'carry_counts', 'like_counts', 'reports', 'daily_posts', 'profiles', 'follows',
  'profile_passages', 'profile_prayers', 'blocks', 'groups', 'group_members', 'group_requests', 'group_intentions',
  'group_carries', 'group_reports', 'profile_reports', 'group_bans', 'banned_terms', 'app_moderators',
  'account_suspensions', 'moderation_log', 'group_gatherings', 'group_novenas', 'adoration_chains', 'group_rosaries'
]) as t;

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select throws_ok(format('select 1 from public.%I', t), '42501', null, 'authenticated ne lit pas ' || t)
from unnest(array[
  'echoes', 'intentions', 'carries', 'carry_counts', 'like_counts', 'reports', 'daily_posts', 'profiles', 'follows',
  'profile_passages', 'profile_prayers', 'blocks', 'groups', 'group_members', 'group_requests', 'group_intentions',
  'group_carries', 'group_reports', 'profile_reports', 'group_bans', 'banned_terms', 'app_moderators',
  'account_suspensions', 'moderation_log', 'group_gatherings', 'group_novenas', 'adoration_chains', 'group_rosaries'
]) as t;
select throws_ok($$insert into public.echoes (user_id, target, body) values (auth.uid(), '1:1:1-1', 'x')$$, '42501', null,
  'authenticated n''écrit pas directement dans echoes');
select throws_ok($$insert into public.app_moderators (user_id) values (auth.uid())$$, '42501', null,
  'authenticated ne s''inscrit pas comme modérateur éditeur');
select throws_ok($$insert into public.account_suspensions (user_id, reason) values (auth.uid(), 'x')$$, '42501', null,
  'authenticated n''écrit pas dans account_suspensions');
select throws_ok($$delete from public.moderation_log$$, '42501', null, 'authenticated ne supprime rien du journal');

-- 2. Une session anonyme ne crée ni profil, ni groupe, ne rejoint rien, ne suit personne.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$select public.save_my_profile('anon_pseudo', 'anon_pseudo', null, null, true)$$, 'P0001', 'auth',
  'une session anonyme ne crée pas de profil');
select throws_ok($$select public.create_group('Mon groupe', '', 'communaute', null)$$, 'P0001', 'auth',
  'une session anonyme ne crée pas de groupe');
select throws_ok($$select public.join_by_code('ABCDEFGH')$$, 'P0001', 'auth', 'une session anonyme ne rejoint pas avec un code');
select throws_ok($$select public.request_join('b0000000-0000-0000-0000-000000000001')$$, 'P0001', 'auth',
  'une session anonyme ne demande pas à rejoindre');
select throws_ok($$select public.follow('test_bob')$$, 'P0001', 'auth', 'une session anonyme ne suit personne');
select throws_ok($$select * from public.list_group_intentions('b0000000-0000-0000-0000-000000000001')$$, 'P0001', 'auth',
  'une session anonyme ne lit pas les intentions d''un groupe');
select is(public.am_i_app_moderator(), false, 'une session anonyme n''est jamais modératrice éditeur, même inscrite');
select throws_ok($$select * from public.mod_queue()$$, 'P0001', 'interdit', 'mod_queue refuse une session anonyme inscrite');

-- 3. Le rôle anon (sans session) n'exécute aucune fonction de l'app.
reset role;
set local role anon;
select throws_ok($$select public.post_echo('1:1:1-1', 'Bonjour')$$, '42501', null, 'anon n''exécute pas post_echo');
select throws_ok($$select public.am_i_app_moderator()$$, '42501', null, 'anon n''exécute pas am_i_app_moderator');
select throws_ok($$select * from public.mod_queue()$$, '42501', null, 'anon n''exécute pas mod_queue');
select throws_ok($$select public.mod_restore('echo', 'x')$$, '42501', null, 'anon n''exécute pas mod_restore');
select throws_ok($$select public.mod_dismiss('echo', 'x')$$, '42501', null, 'anon n''exécute pas mod_dismiss');
select throws_ok($$select public.mod_remove('echo', 'x')$$, '42501', null, 'anon n''exécute pas mod_remove');
select throws_ok($$select public.mod_suspend('echo', 'x', 1, 'x')$$, '42501', null, 'anon n''exécute pas mod_suspend');
select throws_ok($$select * from public.mod_log()$$, '42501', null, 'anon n''exécute pas mod_log');
select throws_ok($$select * from public.my_suspension()$$, '42501', null, 'anon n''exécute pas my_suspension');

-- 4. Un non-membre ne lit rien d'un groupe.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select throws_ok($$select * from public.list_group_intentions('b0000000-0000-0000-0000-000000000001')$$, 'P0001', 'groupe_inconnu',
  'un non-membre ne lit pas les intentions du groupe');
select throws_ok($$select public.post_group_intention('b0000000-0000-0000-0000-000000000001', 'Bonjour')$$, 'P0001', 'groupe_inconnu',
  'un non-membre ne publie pas dans le groupe');
select throws_ok($$select * from public.list_group_reports('b0000000-0000-0000-0000-000000000001')$$, 'P0001', 'groupe_inconnu',
  'un non-membre ne lit pas la file de signalements');
select throws_ok($$select * from public.list_bans('b0000000-0000-0000-0000-000000000001')$$, 'P0001', 'groupe_inconnu',
  'un non-membre ne lit pas la liste des bannis');
select throws_ok($$select public.report_group_intention('c0000000-0000-0000-0000-000000000001')$$, 'P0001', 'intention_inconnue',
  'un non-membre ne signale pas une intention de groupe');

-- 5. Un membre ne lit pas la file de signalements ni les bannis, et n'agit pas dessus ; le propriétaire le peut.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select * from public.list_group_intentions('b0000000-0000-0000-0000-000000000001')$$,
  'un membre lit les intentions du groupe');
select throws_ok($$select * from public.list_group_reports('b0000000-0000-0000-0000-000000000001')$$, 'P0001', 'interdit',
  'un membre ne lit pas la file de signalements');
select throws_ok($$select * from public.list_bans('b0000000-0000-0000-0000-000000000001')$$, 'P0001', 'interdit',
  'un membre ne lit pas la liste des bannis');
select throws_ok($$select public.restore_group_intention('c0000000-0000-0000-0000-000000000001')$$, 'P0001', 'interdit',
  'un membre ne rétablit pas une intention');
select throws_ok($$select public.dismiss_group_reports('c0000000-0000-0000-0000-000000000001')$$, 'P0001', 'interdit',
  'un membre ne clôt pas de signalements');
select throws_ok($$select public.remove_group_intention('c0000000-0000-0000-0000-000000000001')$$, 'P0001', 'interdit',
  'un membre ne retire pas une intention');
select throws_ok($$select public.ban_member('b0000000-0000-0000-0000-000000000001', 'test_alice')$$, 'P0001', 'interdit',
  'un membre ne bannit personne');
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select * from public.list_group_reports('b0000000-0000-0000-0000-000000000001')$$,
  'le propriétaire lit la file de signalements');
select lives_ok($$select * from public.list_bans('b0000000-0000-0000-0000-000000000001')$$,
  'le propriétaire lit la liste des bannis');

-- 6. Les fonctions mod_* refusent un compte qui n'est pas modérateur éditeur (membre de groupe, propriétaire compris).
select is(public.am_i_app_moderator(), false, 'alice n''est pas modératrice éditeur');
select throws_ok($$select * from public.mod_queue()$$, 'P0001', 'interdit', 'mod_queue refuse un non-modérateur');
select throws_ok($$select * from public.mod_log()$$, 'P0001', 'interdit', 'mod_log refuse un non-modérateur');
select throws_ok($$select * from public.mod_suspensions()$$, 'P0001', 'interdit', 'mod_suspensions refuse un non-modérateur');
select throws_ok($$select public.mod_restore('echo', 'c0000000-0000-0000-0000-000000000001')$$, 'P0001', 'interdit',
  'mod_restore refuse un non-modérateur');
select throws_ok($$select public.mod_dismiss('groupe', 'c0000000-0000-0000-0000-000000000001')$$, 'P0001', 'interdit',
  'mod_dismiss refuse un non-modérateur');
select throws_ok($$select public.mod_remove('groupe', 'c0000000-0000-0000-0000-000000000001')$$, 'P0001', 'interdit',
  'mod_remove refuse un non-modérateur');
select throws_ok($$select public.mod_suspend('groupe', 'c0000000-0000-0000-0000-000000000001', 7, 'Test')$$, 'P0001', 'interdit',
  'mod_suspend refuse un non-modérateur');
select throws_ok($$select public.mod_suspend_handle('test_bob', 7, 'Test')$$, 'P0001', 'interdit',
  'mod_suspend_handle refuse un non-modérateur');
select throws_ok($$select public.mod_unsuspend('test_bob')$$, 'P0001', 'interdit', 'mod_unsuspend refuse un non-modérateur');
select is((select count(*)::int from public.my_suspension()), 0, 'alice n''est pas suspendue');

-- 7. La modératrice éditeur entre.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select is(public.am_i_app_moderator(), true, 'mod est modératrice éditeur');
select lives_ok($$select * from public.mod_queue()$$, 'mod lit la file');
select lives_ok($$select * from public.mod_log()$$, 'mod lit le journal');
select lives_ok($$select * from public.mod_suspensions()$$, 'mod lit les suspensions');

select * from finish();
rollback;
