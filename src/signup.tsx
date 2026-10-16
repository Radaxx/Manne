import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

/** Le brouillon du profil, gardé d'une étape de l'inscription à l'autre. Rien n'est envoyé avant la dernière. */
export type SignupDraft = { handle: string; bio: string; parish: string };

type SignupContextValue = { draft: SignupDraft; update: (patch: Partial<SignupDraft>) => void };

const SignupContext = createContext<SignupContextValue | null>(null);

export function SignupProvider({ children }: { children: ReactNode }) {
  const [patch, setPatch] = useState<Partial<SignupDraft>>({});
  const update = useCallback((next: Partial<SignupDraft>) => setPatch((current) => ({ ...current, ...next })), []);
  const value = useMemo<SignupContextValue>(
    () => ({
      draft: { handle: '', bio: '', parish: '', ...patch },
      update,
    }),
    [patch, update],
  );
  return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignup(): SignupContextValue {
  const value = useContext(SignupContext);
  if (!value) throw new Error('useSignup doit être utilisé dans l’inscription');
  return value;
}
