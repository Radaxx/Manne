// API publique de l'authentification. Les modules qui ne dépendent que de la session (community, sync)
// importent ./auth/session directement, pour éviter le cycle community ↔ auth.
export { type AuthContextValue, AuthProvider, type AuthState, useAuth } from './AuthProvider';
export { openAuthUrl } from './adoption';
export type { LinkBranch } from './errors';
export { googleFlowInProgress, handledInApp } from './providers';
export { currentUserId, ensureSession } from './session';
export { type AccountPhase, type SignOutHooks, useAccount } from './useAccount';
