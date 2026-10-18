import { groupIdFromUrl } from '../src/gathering-reminders';
import { DEFAULT_PREFS, LOCAL_ITEMS, PREF_KEYS, PUSH_ITEMS, PUSH_UNAVAILABLE, pushRouteFromUrl, readPrefs } from '../src/push';

const GROUP = 'b0000000-0000-0000-0000-000000000001';

describe('préférences', () => {
  it('garde les défauts décidés : communauté et abonnements activés, vie et nouveautés de groupe désactivées', () => {
    expect(DEFAULT_PREFS.admin).toBe(true);
    expect(DEFAULT_PREFS.follows).toBe(true);
    expect(DEFAULT_PREFS.group_life).toBe(false);
    expect(DEFAULT_PREFS.group_news).toBe(false);
    for (const item of LOCAL_ITEMS) expect(DEFAULT_PREFS[item.key]).toBe(true);
  });

  it('lit la ligne du serveur, et garde le défaut d’une valeur absente ou mal formée', () => {
    expect(readPrefs({ admin: false, group_life: true })).toEqual({ ...DEFAULT_PREFS, admin: false, group_life: true });
    expect(readPrefs({ follows: 'non', local_rosary: 0 })).toEqual(DEFAULT_PREFS);
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(readPrefs('x')).toEqual(DEFAULT_PREFS);
  });

  it('chaque interrupteur de l’écran correspond à une clé unique', () => {
    const keys = [...PUSH_ITEMS, ...LOCAL_ITEMS].map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...PREF_KEYS].sort());
  });
});

describe('libellés', () => {
  it('ne promettent aucun texte d’intention et restent en français', () => {
    for (const item of [...PUSH_ITEMS, ...LOCAL_ITEMS]) {
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.hint.endsWith('.')).toBe(true);
    }
    expect(PUSH_UNAVAILABLE).toBe('Les notifications de la communauté ne sont pas encore disponibles sur cet appareil.');
  });
});

describe('adresses acceptées au toucher', () => {
  it('ouvre les réglages d’un groupe et le profil d’un abonné', () => {
    expect(pushRouteFromUrl(`/groupe/reglages?id=${GROUP}`)).toEqual({ pathname: '/groupe/reglages', params: { id: GROUP } });
    expect(pushRouteFromUrl('/profil/marie_d')).toEqual({ pathname: '/profil/[handle]', params: { handle: 'marie_d' } });
  });

  it('laisse la page d’un groupe aux rappels existants', () => {
    expect(groupIdFromUrl(`/groupe/${GROUP}`)).toBe(GROUP);
    expect(pushRouteFromUrl(`/groupe/${GROUP}`)).toBeNull();
  });

  it('refuse toute autre adresse', () => {
    for (const url of [
      undefined,
      42,
      '',
      '/',
      `https://example.com/groupe/reglages?id=${GROUP}`,
      '/groupe/reglages?id=../../compte',
      `/groupe/reglages?id=${GROUP}&x=1`,
      `/groupe/reglages/${GROUP}`,
      '/profil/AB',
      '/profil/a/b',
      '/profil/marie?x=1',
      '/compte',
      '/moderation',
      'manne://groupe/reglages',
    ]) {
      expect(pushRouteFromUrl(url)).toBeNull();
    }
  });
});

describe('retrait du jeton en attente', () => {
  const KEY = 'manne/push/pending-unregister/v1';

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../src/profile');
  });

  it('rejoue le retrait et ne lève le marqueur qu’une fois le serveur d’accord', async () => {
    const storageModule = require('@react-native-async-storage/async-storage');
    const AsyncStorage = storageModule.default ?? storageModule;
    const callMock = jest.fn();
    jest.doMock('../src/profile', () => ({ call: callMock, asRecord: (v: unknown) => v }));
    const push = require('../src/push');
    await AsyncStorage.setItem(KEY, JSON.stringify({ token: 'ExponentPushToken[abc]' }));

    callMock.mockResolvedValueOnce({ ok: false, message: 'hors ligne' });
    await push.retryPendingUnregister();
    expect(callMock).toHaveBeenCalledWith('unregister_push_token', { p_token: 'ExponentPushToken[abc]' });
    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();

    callMock.mockResolvedValueOnce({ ok: true, data: null });
    await push.retryPendingUnregister();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();

    callMock.mockClear();
    await push.retryPendingUnregister();
    expect(callMock).not.toHaveBeenCalled();
  });
});

describe('cache des préférences', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../src/profile');
  });

  it('partage une seule lecture entre appelants simultanés', async () => {
    const callMock = jest.fn().mockResolvedValue({ ok: true, data: { admin: false } });
    jest.doMock('../src/profile', () => ({ call: callMock, asRecord: (v: unknown) => v }));
    const push = require('../src/push');
    const [a, b, c] = await Promise.all([push.getPrefs(), push.getPrefs(), push.getPrefs()]);
    expect(callMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(c.ok && c.prefs.admin).toBe(false);
  });

  it('une lecture partie avant clearPrefsCache n’écrit pas le cache', async () => {
    let release: (value: unknown) => void = () => {};
    const callMock = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue({ ok: true, data: { admin: true } });
    jest.doMock('../src/profile', () => ({ call: callMock, asRecord: (v: unknown) => v }));
    const push = require('../src/push');
    const stale = push.getPrefs();
    push.clearPrefsCache();
    release({ ok: true, data: { admin: false } });
    await stale;
    const fresh = await push.getPrefs();
    expect(callMock).toHaveBeenCalledTimes(2);
    expect(fresh.ok && fresh.prefs.admin).toBe(true);
  });
});
