-- Notifications push : destinataires, préférences, mute, blocages, suspension, anti-rafale, contenu discret, droits.
-- Lancer : supabase test db   (base locale ; tout est annulé à la fin).
begin;

create extension if not exists pgtap with schema extensions;

select plan(61);

-- alice : propriétaire ; bob : modérateur ; carol : membre ; dave et eve : hors du groupe.
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'alice@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bob@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'carol@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'dave@test.invalid', false),
  ('a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'eve@test.invalid', false);
insert into public.profiles (id, handle, display_name, charter_accepted_at) values
  ('a0000000-0000-0000-0000-000000000001', 'test_alice', 'test_alice', now()),
  ('a0000000-0000-0000-0000-000000000002', 'test_bob', 'test_bob', now()),
  ('a0000000-0000-0000-0000-000000000003', 'test_carol', 'test_carol', now()),
  ('a0000000-0000-0000-0000-000000000004', 'test_dave', 'test_dave', now()),
  ('a0000000-0000-0000-0000-000000000005', 'test_eve', 'test_eve', now());
insert into public.groups (id, name, kind, invite_code, created_by) values
  ('b0000000-0000-0000-0000-000000000001', 'Fraternité de test', 'communaute', 'ABCDEFGH', 'a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'moderator'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'member');
insert into public.push_tokens (token, user_id, platform)
select 'ExponentPushToken[test-' || n || ']', ('a0000000-0000-0000-0000-00000000000' || n)::uuid, 'android' from generate_series(1, 5) n;

-- Le test ne dépend pas des données locales : la transaction est annulée à la fin, rien n'est supprimé pour de bon.
delete from public.push_outbox;

-- 1. Une demande d'adhésion : le propriétaire et le modérateur la reçoivent, pas le simple membre.
insert into public.group_requests (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.push_outbox where kind = 'request'), 2, 'demande : deux destinataires');
select ok(exists (select 1 from public.push_outbox where kind = 'request' and user_id = 'a0000000-0000-0000-0000-000000000001'), 'demande : le propriétaire');
select ok(exists (select 1 from public.push_outbox where kind = 'request' and user_id = 'a0000000-0000-0000-0000-000000000002'), 'demande : le modérateur');
select ok(not exists (select 1 from public.push_outbox where kind = 'request' and user_id = 'a0000000-0000-0000-0000-000000000003'), 'demande : pas le simple membre');
select is((select title from public.push_outbox where kind = 'request' and user_id = 'a0000000-0000-0000-0000-000000000001'),
  'Nouvelle demande pour rejoindre «' || chr(160) || 'Fraternité de test' || chr(160) || '»', 'demande : titre');
select is((select url from public.push_outbox where kind = 'request' and user_id = 'a0000000-0000-0000-0000-000000000001'),
  '/groupe/reglages?id=b0000000-0000-0000-0000-000000000001', 'demande : adresse');

-- 2. Anti-rafale : une deuxième demande dans les 10 minutes ne renvoie rien aux mêmes responsables.
insert into public.group_requests (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.push_outbox where kind = 'request'), 2, 'anti-rafale : pas de deuxième push dans les 10 minutes');
-- Au-delà de la fenêtre, une nouvelle push repart.
update public.push_throttle set last_at = now() - interval '11 minutes' where kind = 'request';
delete from public.group_requests where user_id = 'a0000000-0000-0000-0000-000000000005';
insert into public.group_requests (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.push_outbox where kind = 'request'), 4, 'anti-rafale : après 10 minutes, une nouvelle push');

-- 3. Doublon exact : la même clé ne notifie jamais deux fois.
update public.push_throttle set last_at = now() - interval '11 minutes' where kind = 'request';
delete from public.group_requests where user_id = 'a0000000-0000-0000-0000-000000000005';
insert into public.group_requests (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.push_outbox where kind = 'request'), 4, 'doublon : même événement, une seule push');

-- 4. Préférence coupée et mute du groupe.
delete from public.push_outbox;
delete from public.push_throttle;
delete from public.group_requests;
insert into public.notification_prefs (user_id, admin) values ('a0000000-0000-0000-0000-000000000002', false);
insert into public.group_notification_mutes (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.group_requests (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.push_outbox), 0, 'préférence coupée (bob) et groupe coupé (alice) : aucune push');
delete from public.notification_prefs;
delete from public.group_notification_mutes;

-- 5. Blocage : alice a bloqué dave, elle ne reçoit pas sa demande ; bob oui.
delete from public.push_outbox;
delete from public.push_throttle;
delete from public.group_requests;
insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');
insert into public.group_requests (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');
select is((select array_agg(user_id order by user_id) from public.push_outbox), array['a0000000-0000-0000-0000-000000000002'::uuid],
  'blocage : seul le modérateur reçoit la demande');
delete from public.blocks;

-- 6. Pas de jeton : pas de push.
delete from public.push_outbox;
delete from public.push_throttle;
delete from public.group_requests;
delete from public.push_tokens where user_id = 'a0000000-0000-0000-0000-000000000002';
insert into public.group_requests (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.push_outbox), 1, 'sans jeton : le modérateur est ignoré');
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[test-2]', 'a0000000-0000-0000-0000-000000000002', 'ios');

-- 7. Signalement : les responsables, jamais le signalant lui-même.
insert into public.group_intentions (id, group_id, user_id, body) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'SECRET-INTENTION-TEXTE');
delete from public.push_outbox;
delete from public.push_throttle;
insert into public.group_reports (user_id, intention_id, reason) values ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'spam');
select is((select array_agg(user_id order by user_id) from public.push_outbox where kind = 'report'), array['a0000000-0000-0000-0000-000000000001'::uuid],
  'signalement : le propriétaire, pas le modérateur qui signale');
select is((select title from public.push_outbox where kind = 'report'),
  'Un signalement à traiter dans «' || chr(160) || 'Fraternité de test' || chr(160) || '»', 'signalement : titre');

-- 8. Un compte suspendu ne déclenche aucune push.
delete from public.push_outbox;
delete from public.push_throttle;
delete from public.group_reports;
insert into public.account_suspensions (user_id, until, reason) values ('a0000000-0000-0000-0000-000000000004', now() + interval '1 day', 'test');
insert into public.group_reports (user_id, intention_id) values ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.push_outbox), 0, 'suspension : un signalement d''un compte suspendu ne notifie personne');
delete from public.account_suspensions;

-- 9. Abonnement : « @pseudo te suit », par défaut ; pas de push pour soi-même ; blocage respecté ; préférence respectée.
delete from public.push_outbox;
delete from public.push_throttle;
insert into public.follows (follower_id, followee_id) values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001');
select is((select title from public.push_outbox where kind = 'follow' and user_id = 'a0000000-0000-0000-0000-000000000001'), '@test_dave te suit', 'abonnement : titre');
select is((select url from public.push_outbox where kind = 'follow'), '/profil/test_dave', 'abonnement : adresse');
delete from public.push_outbox;
delete from public.push_throttle;
insert into public.notification_prefs (user_id, follows) values ('a0000000-0000-0000-0000-000000000002', false);
insert into public.follows (follower_id, followee_id) values ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.push_outbox), 0, 'abonnement : préférence coupée, pas de push');
insert into public.blocks (blocker_id, blocked_id) values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005');
insert into public.follows (follower_id, followee_id) values ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.push_outbox), 0, 'abonnement : personne bloquée, pas de push');
delete from public.blocks;
delete from public.notification_prefs;

-- 10. Nouvelle intention : désactivé par défaut ; une fois activé, tous les membres sauf l'auteur.
delete from public.push_outbox;
delete from public.push_throttle;
insert into public.group_intentions (id, group_id, user_id, body) values
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'SECRET-INTENTION-TEXTE');
select is((select count(*)::int from public.push_outbox), 0, 'intention : catégorie désactivée par défaut');
insert into public.notification_prefs (user_id, group_life, group_news) values
  ('a0000000-0000-0000-0000-000000000001', true, true),
  ('a0000000-0000-0000-0000-000000000003', true, true);
delete from public.push_throttle;
insert into public.group_intentions (id, group_id, user_id, body) values
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'SECRET-INTENTION-TEXTE');
select is((select array_agg(user_id order by user_id) from public.push_outbox where kind = 'intention'), array['a0000000-0000-0000-0000-000000000001'::uuid],
  'intention : les membres qui l''ont activé, jamais l''auteur');
select is((select title from public.push_outbox where kind = 'intention'),
  'Nouvelle intention dans «' || chr(160) || 'Fraternité de test' || chr(160) || '»', 'intention : titre');

-- 11. « Prière exaucée » : ceux qui portent l'intention (encore membres), pas l'auteur.
delete from public.push_outbox;
delete from public.push_throttle;
insert into public.group_carries (user_id, intention_id) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003');
update public.group_intentions set answered_at = now(), thanks = 'SECRET-MERCI' where id = 'c0000000-0000-0000-0000-000000000003';
select is((select array_agg(user_id order by user_id) from public.push_outbox where kind = 'answered'), array['a0000000-0000-0000-0000-000000000001'::uuid],
  'exaucée : celui qui porte l''intention et l''a activé (ni l''auteur, ni un non-membre)');
select is((select title from public.push_outbox where kind = 'answered'), 'Une intention que tu portes a été exaucée', 'exaucée : titre');
delete from public.push_throttle;
update public.group_intentions set thanks = 'SECRET-MERCI 2' where id = 'c0000000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.push_outbox where kind = 'answered'), 1, 'exaucée : modifier le mot de remerciement ne renotifie pas');

-- 12. Nouveautés de groupe.
delete from public.push_outbox;
delete from public.push_throttle;
insert into public.group_gatherings (id, group_id, title, recurrence, starts_at, created_by) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'SECRET-TITRE-RDV', 'once', now() + interval '2 days', 'a0000000-0000-0000-0000-000000000003');
select is((select array_agg(user_id order by user_id) from public.push_outbox where kind = 'gathering'), array['a0000000-0000-0000-0000-000000000001'::uuid],
  'rendez-vous : les membres qui l''ont activé, pas le créateur');
select is((select title from public.push_outbox where kind = 'gathering'),
  'Nouveau rendez-vous dans «' || chr(160) || 'Fraternité de test' || chr(160) || '»', 'rendez-vous : titre');
select is((select url from public.push_outbox where kind = 'gathering'), '/groupe/b0000000-0000-0000-0000-000000000001', 'rendez-vous : adresse');
insert into public.group_novenas (id, group_id, model, title, intention, start_date, timezone, created_by) values
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'esprit-saint', 'SECRET-TITRE', 'SECRET-INTENTION-TEXTE',
   current_date, 'Europe/Paris', 'a0000000-0000-0000-0000-000000000003');
select is((select url from public.push_outbox where kind = 'novena'), '/neuvaine/d0000000-0000-0000-0000-000000000002', 'neuvaine : adresse');
delete from public.push_throttle;
insert into public.group_rosaries (id, group_id, start_month, timezone, created_by) values
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 'Europe/Paris', 'a0000000-0000-0000-0000-000000000003');
select is((select url from public.push_outbox where kind = 'rosary'), '/rosaire/d0000000-0000-0000-0000-000000000003', 'Rosaire vivant : adresse');
insert into public.adoration_chains (id, group_id, title, intention, place, starts_at, ends_at, slot_minutes, timezone, created_by) values
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'SECRET-TITRE', 'SECRET-INTENTION-TEXTE', 'SECRET-LIEU',
   now() + interval '2 days', now() + interval '2 days 4 hours', 60, 'Europe/Paris', 'a0000000-0000-0000-0000-000000000003');
select is((select url from public.push_outbox where kind = 'adoration'), '/adoration-chaine/d0000000-0000-0000-0000-000000000004', 'adoration : adresse');

-- 13. Contenu discret : aucun texte saisi (intention, titre, lieu, remerciement) dans aucune push.
select is((select count(*)::int from public.push_outbox where title like '%SECRET%' or body like '%SECRET%' or url like '%SECRET%'), 0,
  'aucun texte saisi dans title, body ni url');

-- 14. Les mêmes événements, sans la catégorie : rien. (alice a tout activé ; carol coupe les groupes.)
delete from public.push_outbox;
delete from public.push_throttle;
insert into public.group_notification_mutes (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001');
insert into public.group_intentions (group_id, user_id, body) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Autre');
select is((select count(*)::int from public.push_outbox), 0, 'mute du groupe : aucune push de groupe');
-- Quitter le groupe retire le mute.
delete from public.group_notification_mutes;
insert into public.group_members (group_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'member');
insert into public.group_notification_mutes (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004');
delete from public.group_members where group_id = 'b0000000-0000-0000-0000-000000000001' and user_id = 'a0000000-0000-0000-0000-000000000004';
select is((select count(*)::int from public.group_notification_mutes), 0, 'quitter le groupe retire le mute');

-- 15. Une erreur de push ne casse pas l'action : un jeton absent de la table n'empêche rien ; pas d'erreur de trigger.
select lives_ok($$insert into public.group_requests (group_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005') on conflict do nothing$$,
  'une demande passe même si la push est ignorée');

-- 16. RPC : une session anonyme est refusée.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":true}', true);
set local role authenticated;
select throws_ok($$select public.register_push_token('ExponentPushToken[anon]', 'android')$$, 'P0001', 'auth', 'anonyme : pas de jeton');
select throws_ok($$select * from public.get_notification_prefs()$$, 'P0001', 'auth', 'anonyme : pas de préférences');
select throws_ok($$select public.set_notification_pref('follows', false)$$, 'P0001', 'auth', 'anonyme : pas de réglage');
select throws_ok($$select public.set_group_muted('b0000000-0000-0000-0000-000000000001', true)$$, 'P0001', 'auth', 'anonyme : pas de mute');

-- 17. RPC : compte relié.
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select lives_ok($$select public.register_push_token('ExponentPushToken[carol-phone]', 'ios')$$, 'relié : enregistre un jeton');
select throws_ok($$select public.register_push_token('pas-un-jeton', 'ios')$$, 'P0001', 'jeton_invalide', 'jeton invalide refusé');
select throws_ok($$select public.set_notification_pref('nimporte', true)$$, 'P0001', 'cle_invalide', 'clé inconnue refusée');
select is((select group_life from public.get_notification_prefs()), true, 'préférences lues (carol a activé group_life)');
select lives_ok($$select public.set_notification_pref('follows', false)$$, 'relié : change une préférence');
select is((select follows from public.get_notification_prefs()), false, 'la préférence a changé');
select lives_ok($$select public.set_group_muted('b0000000-0000-0000-0000-000000000001', true)$$, 'membre : coupe le groupe');
select is(public.is_group_muted('b0000000-0000-0000-0000-000000000001'), true, 'le groupe est coupé');
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}', true);
set local role authenticated;
select throws_ok($$select public.set_group_muted('b0000000-0000-0000-0000-000000000001', true)$$, 'P0001', 'groupe_inconnu', 'non-membre : ne coupe pas un groupe');
-- Le jeton d'un autre compte passe au compte qui le présente, et seul son propriétaire peut le retirer.
select lives_ok($$select public.register_push_token('ExponentPushToken[carol-phone]', 'ios')$$, 'même appareil, autre compte : le jeton change de propriétaire');
reset role;
select is((select user_id from public.push_tokens where token = 'ExponentPushToken[carol-phone]'), 'a0000000-0000-0000-0000-000000000004'::uuid, 'propriétaire du jeton mis à jour');

-- 18. Tables illisibles et fonctions de service interdites aux clients.
set local role authenticated;
select throws_ok($$select * from public.push_outbox$$, '42501', null, 'push_outbox illisible');
select throws_ok($$select * from public.push_tokens$$, '42501', null, 'push_tokens illisible');
select throws_ok($$select * from public.notification_prefs$$, '42501', null, 'notification_prefs illisible');
select throws_ok($$select * from public.claim_push_outbox(10)$$, '42501', null, 'claim_push_outbox refusée à un client');
select throws_ok($$select public.push_drop_token('x')$$, '42501', null, 'push_drop_token refusée à un client');
reset role;
set local role anon;
select throws_ok($$select public.register_push_token('ExponentPushToken[x]', 'ios')$$, '42501', null, 'anon n''exécute pas register_push_token');

-- 19. Côté service : réclamation, rapport, expiration.
reset role;
delete from public.push_outbox;
delete from public.push_throttle;
insert into public.push_outbox (user_id, kind, title, body, url, dedupe_key) values
  ('a0000000-0000-0000-0000-000000000004', 'follow', 't', 'b', '/x', 'k1'),
  ('a0000000-0000-0000-0000-000000000001', 'follow', 't', 'b', '/x', 'k2');
select is((select count(*)::int from public.claim_push_outbox(10) where tokens <> '{}'), 2, 'service : réclame les lignes avec leurs jetons');
select is((select count(*)::int from public.claim_push_outbox(10)), 0, 'service : une ligne réclamée n''est pas redonnée');
select public.push_report_sent(jsonb_build_array(jsonb_build_object('id', (select min(id) from public.push_outbox),
  'tickets', jsonb_build_array(jsonb_build_object('ticket', 'tk-1', 'token', 'ExponentPushToken[carol-phone]')))));
select ok((select sent_at is not null from public.push_outbox order by id limit 1), 'service : ligne marquée envoyée avec ticket');
update public.push_tickets set created_at = now() - interval '20 minutes';
select is((select count(*)::int from public.claim_push_tickets(10)), 1, 'service : ticket prêt pour son reçu');
select public.push_report_receipts('[{"ticket":"tk-1","status":"error","error":"DeviceNotRegistered"}]'::jsonb);
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[carol-phone]'), 0, 'DeviceNotRegistered : le jeton est supprimé');

select * from finish();
rollback;
