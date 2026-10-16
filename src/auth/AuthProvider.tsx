import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

export type AuthState = {
  configured: boolean;
  /** `unconfigured` tant que Supabase n'est pas branché ; `anonymous` aussi tant qu'aucune session n'existe. */
  status: 'unconfigured' | 'anonymous' | 'signedIn';
  userId: string | null;
  email: string | null;
};

const configured = supabase != null;
const INITIAL: AuthState = { configured, status: configured ? 'anonymous' : 'unconfigured', userId: null, email: null };

const AuthContext = createContext<AuthState | null>(null);

function fromUser(user: { id: string; is_anonymous?: boolean; email?: string | null } | null): AuthState {
  if (!configured) return INITIAL;
  return {
    configured,
    status: user?.is_anonymous === false ? 'signedIn' : 'anonymous',
    userId: user?.id ?? null,
    email: user?.email ?? null,
  };
}

function same(a: AuthState, b: AuthState) {
  return a.status === b.status && a.userId === b.userId && a.email === b.email;
}

/** Une seule écoute de la session pour toute l'app : les écrans lisent l'état avec useAuth. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let alive = true;
    const apply = (user: Parameters<typeof fromUser>[0]) => {
      const next = fromUser(user);
      setState((current) => (same(current, next) ? current : next));
    };
    void client.auth.getSession().then(({ data }) => {
      if (alive) apply(data.session?.user ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return state;
}
