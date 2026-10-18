-- Durcissement (018) : signalements réservés aux comptes reliés, seuils sans comptes anonymes, garde de user_state,
-- list_members qui masque les paires bloquées.
-- Lancer : supabase test db   (base locale ; tout est annulé à la fin).
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- 1..5 : comptes reliés ; 6 : anonyme ; 7..9 : anonymes supplémentaires (signalements hérités).
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'author@test.invalid', false),
  ('c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'r2@test.invalid', false),
  ('c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'r3@test.invalid', false),
  ('c0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'r4@test.invalid', false),
  ('c0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', null, true),
  ('c0000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', null, true),
  ('c0000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', null, true);
insert into public.profiles (id, handle, display_name, charter_accepted_at) values
  ('c0000000-0000-0000-0000-000000000001', 'test_author', 'test_author', now()),
  ('c0000000-0000-0000-0000-000000000002', 'test_viewer', 'test_viewer', now()),
  ('c0000000-0000-0000-0000-000000000003', 'test_blocked', 'test_blocked', now()),
  ('c0000000-0000-0000-0000-000000000004', 'test_other', 'test_other', now());
insert into public.echoes (id, user_id, target, body) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '1:1:1-1', 'Écho signalé par des anonymes'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', '1:1:2-2', 'Écho signalé par des comptes reliés'),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', '1:1:3-3', 'Écho pour l''anonyme');
insert into public.groups (id, name, kind, invite_code, created_by) values
  ('b0000000-0000-0000-0000-0000000000a1', 'Groupe durci', 'communaute', 'ZZZZZZZZ', 'c0000000-0000-0000-0000-000000000002');
insert into public.group_members (group_id, user_id, role) values
  ('b0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000004', 'owner'),
  ('b0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000003', 'member'),
  ('b0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000002', 'member');
insert into public.blocks (blocker_id, blocked_id) values
  ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003');

-- 1. Un compte anonyme ne signale pas.
reset role;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000006","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$select public.report_echo('e0000000-0000-0000-0000-000000000003', 'spam')$$, 'P0001', 'compte_requis',
  'anonyme : pas de signalement d''écho');

-- 2. Un compte relié signale.
reset role;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.report_echo('e0000000-0000-0000-0000-000000000003', 'spam')$$, 'relié : signalement accepté');

-- 3. Trois signalements hérités de comptes anonymes ne masquent pas l'écho.
reset role;
insert into public.reports (user_id, echo_id) values
  ('c0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001');
select is((select hidden from public.echoes where id = 'e0000000-0000-0000-0000-000000000001'), false,
  '3 signalements anonymes : écho non masqué');

-- 4. Trois comptes reliés masquent l'écho.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select public.report_echo('e0000000-0000-0000-0000-000000000002', 'spam');
reset role;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select public.report_echo('e0000000-0000-0000-0000-000000000002', 'spam');
reset role;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select public.report_echo('e0000000-0000-0000-0000-000000000002', 'spam');
reset role;
select is((select hidden from public.echoes where id = 'e0000000-0000-0000-0000-000000000002'), true,
  '3 signalements de comptes reliés : écho masqué');

-- 5. L'anonyme ne signale pas non plus une intention du fil.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000006","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$select public.report_intention('f0000000-0000-0000-0000-0000000000f1', 'spam')$$, 'P0001', 'compte_requis',
  'anonyme : pas de signalement d''intention');
reset role;

-- 6. user_state : la liste de confession est vidée, le reste est conservé.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
insert into public.user_state (user_id, state) values
  ('c0000000-0000-0000-0000-000000000002', '{"confession":{"items":[{"id":"x","text":"secret"}],"lastConfession":"2026-01-01"},"other":1}');
select is((select state from public.user_state where user_id = 'c0000000-0000-0000-0000-000000000002'),
  '{"confession":{"items":[],"lastConfession":"2026-01-01"},"other":1}'::jsonb, 'user_state : items vidé à l''insertion');

-- 7. Idem à la mise à jour.
update public.user_state set state = '{"confession":{"items":["a"],"lastConfession":null},"other":2}'
where user_id = 'c0000000-0000-0000-0000-000000000002';
select is((select state #> '{confession,items}' from public.user_state where user_id = 'c0000000-0000-0000-0000-000000000002'),
  '[]'::jsonb, 'user_state : items vidé à la mise à jour');

-- 8. Un état sans confession passe tel quel.
update public.user_state set state = '{"other":3}' where user_id = 'c0000000-0000-0000-0000-000000000002';
select is((select state from public.user_state where user_id = 'c0000000-0000-0000-0000-000000000002'), '{"other":3}'::jsonb,
  'user_state : sans confession, inchangé');

-- 9. Un état trop gros est refusé.
select throws_ok(
  $$update public.user_state set state = jsonb_build_object('blob', (select string_agg(md5(i::text), '') from generate_series(1, 20000) i))
    where user_id = 'c0000000-0000-0000-0000-000000000002'$$,
  'P0001', 'etat_trop_gros', 'user_state : plus de 512 ko refusé');

-- 10. list_members : le membre bloqué n'a plus de pseudo pour celui qui l'a bloqué.
select is((select count(*)::int from public.list_members('b0000000-0000-0000-0000-0000000000a1') where handle = 'test_blocked'), 0,
  'list_members : pseudo du membre bloqué masqué');

-- 11. Les autres membres restent visibles.
select is((select count(*)::int from public.list_members('b0000000-0000-0000-0000-0000000000a1') where handle in ('test_viewer', 'test_other')), 2,
  'list_members : les autres membres restent visibles');

-- 12. Le propriétaire (qui a bloqué test_blocked) voit encore son pseudo, pour pouvoir agir.
reset role;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select is((select count(*)::int from public.list_members('b0000000-0000-0000-0000-0000000000a1') where handle = 'test_blocked'), 1,
  'list_members : le propriétaire voit encore le membre bloqué');

select * from finish();
rollback;
