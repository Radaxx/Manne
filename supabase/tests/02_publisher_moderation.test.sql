-- Modération éditeur : file globale, actions, suspension par l'auteur d'un élément, journal en ajout seulement.
-- Lancer : supabase test db   (base locale ; tout est annulé à la fin).
begin;

create extension if not exists pgtap with schema extensions;

select plan(80);

-- alice : propriétaire du groupe ; bob : auteur des contenus signalés ; carol, dave, erin : signalent ; mod : modératrice
-- éditeur ; ghost : auteur d'un écho, sans profil.
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'alice@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bob@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'carol@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'mod@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'dave@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'erin@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', null, true);
insert into public.profiles (id, handle, display_name, bio, parish, charter_accepted_at) values
  ('a0000000-0000-0000-0000-000000000001', 'test_alice', 'test_alice', null, null, now()),
  ('a0000000-0000-0000-0000-000000000002', 'test_bob', 'test_bob', 'Une bio à surveiller', 'Une paroisse', now()),
  ('a0000000-0000-0000-0000-000000000003', 'test_carol', 'test_carol', null, null, now()),
  ('a0000000-0000-0000-0000-000000000004', 'test_mod', 'test_mod', null, null, now()),
  ('a0000000-0000-0000-0000-000000000005', 'test_dave', 'test_dave', null, null, now()),
  ('a0000000-0000-0000-0000-000000000006', 'test_erin', 'test_erin', null, null, now());
insert into public.app_moderators (user_id) values ('a0000000-0000-0000-0000-000000000004');
insert into public.groups (id, name, kind, invite_code, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'Groupe de test', 'communaute', 'ABCDEFGH', 'a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member');
insert into public.echoes (id, user_id, target, body) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '1:1:1-1', 'Écho à surveiller'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '1:1:2-2', 'Autre écho'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000007', '1:1:3-3', 'Écho sans profil');
insert into public.intentions (id, user_id, body, withdrawn_at) values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Intention à surveiller', null),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Intention retirée par son auteur', now());
insert into public.profile_prayers (user_id, prayer_id, title, body) values
  ('a0000000-0000-0000-0000-000000000002', 'p1', 'Titre', 'Texte de la prière');
insert into public.group_intentions (id, group_id, user_id, body) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Intention de groupe'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Autre intention de groupe');

-- Trois signalements (carol, dave, erin) sur chaque élément : les triggers les masquent.
insert into public.reports (user_id, echo_id, reason) values
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'insulte'),
  ('a0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'insulte'),
  ('a0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'spam');
insert into public.reports (user_id, intention_id, reason)
  select u, 'f0000000-0000-0000-0000-000000000001', 'autre'
  from unnest(array['a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005',
                    'a0000000-0000-0000-0000-000000000006']::uuid[]) u;
insert into public.reports (user_id, intention_id, reason) values
  ('a0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', 'spam');
insert into public.reports (user_id, echo_id, reason) values
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'inapproprie');
insert into public.profile_reports (reporter_id, target_id, subject, reason)
  select u, 'a0000000-0000-0000-0000-000000000002', 'profil', 'inapproprie'
  from unnest(array['a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005',
                    'a0000000-0000-0000-0000-000000000006']::uuid[]) u;
insert into public.profile_reports (reporter_id, target_id, subject, prayer_id, reason)
  select u, 'a0000000-0000-0000-0000-000000000002', 'priere', 'p1', 'insulte'
  from unnest(array['a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005',
                    'a0000000-0000-0000-0000-000000000006']::uuid[]) u;
insert into public.group_reports (user_id, intention_id, reason)
  select u, 'c0000000-0000-0000-0000-000000000001', 'spam'
  from unnest(array['a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005',
                    'a0000000-0000-0000-0000-000000000006']::uuid[]) u;

select is((select hidden from public.echoes where id = 'e0000000-0000-0000-0000-000000000001'), true, 'trois signalements masquent l''écho');
select is((select auto_hidden from public.intentions where id = 'f0000000-0000-0000-0000-000000000001'), true,
  'trois signalements retirent l''intention et le notent');
select is((select auto_hidden from public.intentions where id = 'f0000000-0000-0000-0000-000000000002'), false,
  'une intention retirée par son auteur n''est pas notée comme retirée par les signalements');
select isnt((select flagged_at from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'), null, 'le profil est masqué');
select isnt((select hidden_at from public.profile_prayers where prayer_id = 'p1'), null, 'la prière de vitrine est masquée');
select is((select hidden from public.group_intentions where id = 'c0000000-0000-0000-0000-000000000001'), true,
  'l''intention de groupe est masquée');

-- La file.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;

select is((select reports from public.mod_queue() where kind = 'echo' and id = 'e0000000-0000-0000-0000-000000000001'), 3,
  'la file compte les signalements de l''écho');
select is((select insulte from public.mod_queue() where id = 'e0000000-0000-0000-0000-000000000001'), 2, 'motifs : insulte');
select is((select spam from public.mod_queue() where id = 'e0000000-0000-0000-0000-000000000001'), 1, 'motifs : spam');
select is((select handle from public.mod_queue() where id = 'e0000000-0000-0000-0000-000000000001'), 'test_bob',
  'la file donne le pseudo de l''auteur');
select is((select hidden from public.mod_queue() where id = 'e0000000-0000-0000-0000-000000000001'), true, 'l''écho est masqué');
select is((select handle from public.mod_queue() where id = 'e0000000-0000-0000-0000-000000000003'), null,
  'un compte sans profil n''a pas de pseudo');
select is((select hidden from public.mod_queue() where id = 'f0000000-0000-0000-0000-000000000001'), true, 'l''intention du fil est retirée');
select is((select reports from public.mod_queue() where kind = 'profil' and id = 'test_bob'), 3, 'le profil signalé est dans la file');
select is((select body from public.mod_queue() where kind = 'profil' and id = 'test_bob'), E'Une bio à surveiller\nUne paroisse',
  'la file montre la bio et la paroisse');
select is((select reports from public.mod_queue() where kind = 'priere' and id = 'test_bob:p1'), 3, 'la prière de vitrine est dans la file');
select is((select group_name from public.mod_queue() where kind = 'groupe' and id = 'c0000000-0000-0000-0000-000000000001'),
  'Groupe de test', 'la file donne le nom du groupe');
select ok((select min(ord) from (select row_number() over () as ord, hidden from public.mod_queue()) q where q.hidden) = 1,
  'les éléments masqués passent d''abord');
select ok(not exists (
  select 1 from pg_proc p where p.proname = 'mod_queue' and p.proargnames::text ~ 'user_id|author_id|uid'
), 'mod_queue n''expose aucun identifiant d''utilisateur');

-- Rétablir un écho : il redevient visible, ses signalements sont clos, le journal le dit.
select lives_ok($$select public.mod_restore('echo', 'e0000000-0000-0000-0000-000000000001')$$, 'mod rétablit l''écho');
reset role;
select is((select hidden from public.echoes where id = 'e0000000-0000-0000-0000-000000000001'), false, 'l''écho est visible');
select is((select count(*)::int from public.reports where echo_id = 'e0000000-0000-0000-0000-000000000001' and resolved_at is null), 0,
  'ses signalements sont clos');
select is((select count(*)::int from public.moderation_log
  where action = 'restore' and kind = 'echo' and target_ref = 'e0000000-0000-0000-0000-000000000001'
    and moderator_id = 'a0000000-0000-0000-0000-000000000004' and target_user = 'a0000000-0000-0000-0000-000000000002'), 1,
  'le journal écrit le rétablissement');
-- Un seul nouveau signalement ne remasque pas l'écho rétabli : les anciens sont clos.
insert into public.reports (user_id, echo_id, reason) values
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'autre');
select is((select hidden from public.echoes where id = 'e0000000-0000-0000-0000-000000000001'), false,
  'un nouveau signalement ne remasque pas un écho rétabli');

-- Intentions du fil : rétablir celle que les signalements ont retirée ; ne pas ressusciter celle que l'auteur a retirée.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.mod_restore('intention', 'f0000000-0000-0000-0000-000000000001')$$, 'mod rétablit l''intention');
select lives_ok($$select public.mod_dismiss('intention', 'f0000000-0000-0000-0000-000000000002')$$,
  'mod clôt les signalements d''une intention retirée par son auteur');
reset role;
select is((select withdrawn_at from public.intentions where id = 'f0000000-0000-0000-0000-000000000001'), null,
  'l''intention retirée par les signalements est rétablie');
select isnt((select withdrawn_at from public.intentions where id = 'f0000000-0000-0000-0000-000000000002'), null,
  'l''intention retirée par son auteur le reste');
select is((select count(*)::int from public.reports where intention_id = 'f0000000-0000-0000-0000-000000000002' and resolved_at is null), 0,
  'ses signalements sont clos');

-- Profil, prière de vitrine, intention de groupe.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.mod_remove('profil', 'test_bob')$$, 'mod efface la bio et la paroisse');
select lives_ok($$select public.mod_remove('priere', 'test_bob:p1')$$, 'mod supprime la prière de vitrine');
select lives_ok($$select public.mod_dismiss('groupe', 'c0000000-0000-0000-0000-000000000001')$$, 'mod laisse visible l''intention de groupe');
select lives_ok($$select public.mod_remove('echo', 'e0000000-0000-0000-0000-000000000003')$$, 'mod supprime un écho');
reset role;
select is((select bio from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'), null, 'la bio est effacée');
select is((select parish from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'), null, 'la paroisse est effacée');
select is((select flagged_at from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'), null, 'le drapeau du profil est levé');
select is((select count(*)::int from public.profile_prayers where prayer_id = 'p1'), 0, 'la prière est supprimée');
select is((select count(*)::int from public.profile_reports where resolved_at is null and target_id::text like 'a0000000-0000-0000-0000-%'), 0, 'les signalements de profil sont clos');
select is((select hidden from public.group_intentions where id = 'c0000000-0000-0000-0000-000000000001'), false,
  'l''intention de groupe est visible');
select is((select count(*)::int from public.group_reports where intention_id = 'c0000000-0000-0000-0000-000000000001' and resolved_at is null), 0,
  'ses signalements sont clos');
select is((select count(*)::int from public.echoes where id = 'e0000000-0000-0000-0000-000000000003'), 0, 'l''écho est supprimé');
select is((select count(*)::int from public.moderation_log
  where moderator_id = 'a0000000-0000-0000-0000-000000000004' and action in ('restore', 'dismiss', 'remove')), 7,
  'chaque action écrit une ligne dans le journal');

-- Suspension de l'auteur d'un élément, sans exposer son identifiant.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.mod_suspend('echo', 'e0000000-0000-0000-0000-000000000002', 7, '  Propos blessants répétés  ')$$,
  'mod suspend l''auteur d''un écho');
select is((select count(*)::int from public.mod_suspensions() where handle = 'test_bob'), 1, 'la suspension est listée');
select is((select reason from public.mod_suspensions() where handle = 'test_bob'), 'Propos blessants répétés', 'le motif est nettoyé');
select is((select suspended_by from public.mod_suspensions() where handle = 'test_bob'), 'test_mod', 'la suspension dit qui l''a décidée');
select ok((select until from public.mod_suspensions() where handle = 'test_bob') between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour',
  'la suspension dure 7 jours');
select lives_ok($$select public.mod_suspend('echo', 'e0000000-0000-0000-0000-000000000002', null, 'Récidive')$$,
  'mod prolonge sans fin la suspension');
select is((select until from public.mod_suspensions() where handle = 'test_bob'), null, 'la suspension n''a plus de fin');
select is((select count(*)::int from public.mod_suspensions() where handle = 'test_bob'), 1, 'une seule suspension par compte');
select lives_ok($$select public.mod_unsuspend('test_bob')$$, 'mod lève la suspension par pseudo');
select is((select count(*)::int from public.mod_suspensions() where handle = 'test_bob'), 0, 'la suspension est levée');
select lives_ok($$select public.mod_suspend_handle('test_carol', 30, 'Spam')$$, 'mod suspend par pseudo');
select lives_ok($$select public.mod_unsuspend((select id::text from public.mod_suspensions() where handle = 'test_carol'))$$,
  'mod lève la suspension par identifiant de suspension');

-- Erreurs.
select throws_ok($$select public.mod_suspend('echo', 'e0000000-0000-0000-0000-000000000002', 0, 'x')$$, 'P0001', 'duree_invalide',
  'une durée nulle est refusée');
select throws_ok($$select public.mod_suspend('echo', 'e0000000-0000-0000-0000-000000000002', 7, '   ')$$, 'P0001', 'motif_invalide',
  'un motif vide est refusé');
select throws_ok($$select public.mod_suspend('echo', 'e0000000-0000-0000-0000-000000000002', 7, repeat('x', 281))$$, 'P0001', 'motif_invalide',
  'un motif trop long est refusé');
select throws_ok($$select public.mod_suspend_handle('test_mod', 7, 'x')$$, 'P0001', 'interdit', 'on ne se suspend pas soi-même');
select throws_ok($$select public.mod_suspend_handle('nobody', 7, 'x')$$, 'P0001', 'introuvable', 'un pseudo inconnu est refusé');
select throws_ok($$select public.mod_restore('truc', 'x')$$, 'P0001', 'kind_invalide', 'un kind inconnu est refusé');
select throws_ok($$select public.mod_remove('echo', 'pas-un-uuid')$$, 'P0001', 'introuvable', 'un identifiant illisible est refusé');
select throws_ok($$select public.mod_unsuspend('test_alice')$$, 'P0001', 'introuvable', 'lever une suspension inexistante est refusé');

-- Actions de modération de groupe : elles écrivent aussi dans le journal. Chaque requête sur le journal se limite aux
-- comptes de test : une base de développement contient déjà de vraies lignes.
reset role;
insert into public.group_reports (user_id, intention_id, reason) values
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'spam');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.dismiss_group_reports('c0000000-0000-0000-0000-000000000002')$$, 'alice laisse visible');
select lives_ok($$select public.restore_group_intention('c0000000-0000-0000-0000-000000000002')$$, 'alice rétablit');
select lives_ok($$select public.remove_group_intention('c0000000-0000-0000-0000-000000000002')$$, 'alice retire');
select lives_ok($$select public.ban_member('b0000000-0000-0000-0000-000000000001', 'test_bob')$$, 'alice bannit bob');
select lives_ok($$select public.unban_member('b0000000-0000-0000-0000-000000000001', 'test_bob')$$, 'alice lève le bannissement');
select lives_ok($$select public.unban_member('b0000000-0000-0000-0000-000000000001', 'test_bob')$$, 'lever deux fois ne casse rien');
reset role;
select is((select array_agg(action order by id) from public.moderation_log where moderator_id = 'a0000000-0000-0000-0000-000000000001'),
  array['group_dismiss', 'group_restore', 'group_remove', 'group_ban', 'group_unban'],
  'le journal contient les cinq actions de groupe, une fois chacune');
select is((select target_user from public.moderation_log where action = 'group_ban' and moderator_id = 'a0000000-0000-0000-0000-000000000001'), 'a0000000-0000-0000-0000-000000000002'::uuid,
  'le bannissement journalise la personne bannie');

-- Le journal ne garde aucun pseudo : après la suppression d'un compte, rien ne le désigne plus.
select is((select target_ref from public.moderation_log where action = 'remove' and kind = 'profil' and moderator_id = 'a0000000-0000-0000-0000-000000000004'), null,
  'le journal ne garde pas le pseudo d''un profil modéré');
select is((select count(*)::int from public.moderation_log where (target_ref like '%test\_%' or note like '%test\_%') and moderator_id::text like 'a0000000-0000-0000-0000-%'), 0,
  'aucune ligne du journal ne contient un pseudo');

-- Le journal est en ajout seulement, même pour le propriétaire des tables.
select throws_ok($$update public.moderation_log set note = 'modifié'$$, 'P0001', 'journal_en_ajout_seulement', 'on ne modifie pas le journal');
select throws_ok($$delete from public.moderation_log$$, 'P0001', 'journal_en_ajout_seulement', 'on ne supprime pas du journal');
select throws_ok($$truncate public.moderation_log$$, 'P0001', 'journal_en_ajout_seulement', 'on ne vide pas le journal');

-- mod_log lit le journal.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select ok((select count(*) from public.mod_log(500) where moderator = 'test_mod' and action = 'suspend') >= 2, 'mod_log montre les suspensions');
select is((select count(*)::int from public.mod_log(3)), 3, 'mod_log respecte la limite');
reset role;

-- Supprimer un compte anonymise le journal sans le supprimer.
select lives_ok($$delete from auth.users where id = 'a0000000-0000-0000-0000-000000000004'$$, 'la modératrice supprime son compte');
select is((select count(*)::int from public.moderation_log where moderator_id = 'a0000000-0000-0000-0000-000000000004'), 0,
  'son identifiant a disparu du journal');
select ok((select count(*) from public.moderation_log where moderator_id is null and action = 'suspend') >= 2,
  'ses lignes restent, anonymisées');

select * from finish();
rollback;
