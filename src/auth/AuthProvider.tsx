import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMyProfile, type MyProfile } from '../profile';
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

/** L'état de la session, plus le profil du compte relié (nul sans compte relié ou sans profil créé). */
export type AuthContextValue = AuthState & {
  profile: MyProfile | null;
  /** Vrai quand le profil du compte courant est connu (toujours vrai sans compte relié : rien à charger). */
  profileLoaded: boolean;
  /** Vrai si le profil n'a pas pu être lu (réseau) : `profile` nul ne veut alors pas dire « pas de profil ». */
  profileOffline: boolean;
  refreshProfile: () => Promise<void>;
};

type LoadedProfile = { userId: string; profile: MyProfile | null; offline: boolean };

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const [loadedProfile, setLoadedProfile] = useState<LoadedProfile | null>(null);
  const { status, userId } = state;

  const refreshProfile = useCallback(async () => {
    if (status !== 'signedIn' || !userId) return;
    const result = await getMyProfile();
    setLoadedProfile({ userId, profile: result.ok ? result.profile : null, offline: !result.ok });
  }, [status, userId]);

  // Le profil se recharge à chaque changement de compte ; un autre compte ne voit jamais celui du précédent.
  useEffect(() => {
    if (status !== 'signedIn' || !userId) {
      setLoadedProfile(null);
      return;
    }
    let alive = true;
    void getMyProfile().then((result) => {
      if (alive) setLoadedProfile({ userId, profile: result.ok ? result.profile : null, offline: !result.ok });
    });
    return () => {
      alive = false;
    };
  }, [status, userId]);

  const value = useMemo<AuthContextValue>(() => {
    const current = status === 'signedIn' && loadedProfile?.userId === userId ? loadedProfile : null;
    return {
      ...state,
      profile: current?.profile ?? null,
      profileLoaded: status !== 'signedIn' || current !== null,
      profileOffline: current?.offline ?? false,
      refreshProfile,
    };
  }, [state, status, userId, loadedProfile, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return state;
}
