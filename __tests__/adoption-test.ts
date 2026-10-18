import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRpc = jest.fn();
const mockStore: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore[k] ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete mockStore[k];
  }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('../src/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
jest.mock('../src/auth/session', () => ({ currentUserId: jest.fn() }));

import { adoptPending, clearNonce, hasPendingNonce, rememberNonce } from '../src/auth/adoption';

beforeEach(async () => {
  mockRpc.mockReset();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  await AsyncStorage.clear();
  await clearNonce();
});

describe('adoptPending', () => {
  it('réussite : le nonce est effacé', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await rememberNonce('n1');
    expect(await adoptPending()).toBeNull();
    expect(await hasPendingNonce()).toBe(false);
  });

  it('erreur réseau (rejet ou erreur renvoyée) : le nonce reste pour un nouvel essai', async () => {
    await rememberNonce('n1');
    mockRpc.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await adoptPending()).not.toBeNull();
    expect(await hasPendingNonce()).toBe(true);
    mockRpc.mockResolvedValueOnce({ error: { message: 'TypeError: Network request failed' } });
    expect(await adoptPending()).not.toBeNull();
    expect(await hasPendingNonce()).toBe(true);
    mockRpc.mockResolvedValueOnce({ error: null });
    expect(await adoptPending()).toBeNull();
    expect(await hasPendingNonce()).toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(3);
  });

  it('nonce invalide ou expiré : abandonné', async () => {
    await rememberNonce('n1');
    mockRpc.mockResolvedValue({ error: { message: 'nonce' } });
    expect(await adoptPending()).toContain('trop ancien');
    expect(await hasPendingNonce()).toBe(false);
  });

  it('session expirée (auth) : le nonce reste', async () => {
    await rememberNonce('n1');
    mockRpc.mockResolvedValue({ error: { message: 'auth' } });
    await adoptPending();
    expect(await hasPendingNonce()).toBe(true);
  });

  it('migre l’ancien nonce d’AsyncStorage vers le trousseau', async () => {
    await AsyncStorage.setItem('manne/auth/pending-nonce', 'old');
    mockRpc.mockResolvedValue({ error: { message: 'boom' } });
    await adoptPending();
    expect(mockRpc).toHaveBeenCalledWith('adopt_account', { p_nonce: 'old' });
    expect(mockStore['manne.auth.pending-nonce']).toBe('old');
    expect(await AsyncStorage.getItem('manne/auth/pending-nonce')).toBeNull();
  });

  it('ne garde plus le nonce dans AsyncStorage', async () => {
    await rememberNonce('n2');
    expect(await AsyncStorage.getItem('manne/auth/pending-nonce')).toBeNull();
    expect(mockStore['manne.auth.pending-nonce']).toBe('n2');
  });
});
