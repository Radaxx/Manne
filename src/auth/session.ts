import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { missingUser } from './errors';

let sessionInflight: Promise<boolean> | null = null;
/** Utilisateur déjà confirmé auprès du serveur, pour ne pas le revérifier à chaque appel. */
let checkedUserId: string | null = null;

/** La session locale peut survivre à la suppression de l'utilisateur. On la jette alors. */
async function sessionAlive(client: SupabaseClient): Promise<boolean> {
  const { data } = await client.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return false;
  if (checkedUserId === id) return true;
  const { data: userData, error } = await client.auth.getUser();
  if (!error && userData.user) {
    checkedUserId = userData.user.id;
    return true;
  }
  if (!missingUser(error)) return true;
  checkedUserId = null;
  await client.auth.signOut({ scope: 'local' });
  return false;
}

/** Ouvre une session anonyme au premier besoin. Faux si le réseau ou le projet manque. */
export function ensureSession(): Promise<boolean> {
  const client = supabase;
  if (!client) return Promise.resolve(false);
  if (!sessionInflight) {
    sessionInflight = (async () => {
      try {
        if (await sessionAlive(client)) return true;
        const { data: signed, error } = await client.auth.signInAnonymously();
        if (!error && signed.session) checkedUserId = signed.session.user.id;
        return !error && !!signed.session;
      } catch {
        return false;
      } finally {
        sessionInflight = null;
      }
    })();
  }
  return sessionInflight;
}

export async function currentUserId(): Promise<string | null> {
  const client = supabase;
  if (!client || !(await ensureSession())) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}
