import {
  excerpt,
  hasShowcase,
  isShowablePassage,
  passageKey,
  readIntentionRow,
  readPassageRow,
  readPrayerRow,
  readShowcase,
  removedKeys,
} from '../src/showcase';

const passage = { book: 19, chapter: 23, from: 1, to: 6 };

describe('passageKey', () => {
  it('est livre:chapitre:premier-dernier, comme la clé communautaire', () => {
    expect(passageKey(passage)).toBe('19:23:1-6');
    expect(passageKey({ book: 43, chapter: 3, from: 16, to: 16 })).toBe('43:3:16-16');
  });
});

describe('isShowablePassage', () => {
  it('accepte des bornes valides', () => {
    expect(isShowablePassage(passage)).toBe(true);
    expect(isShowablePassage({ book: 73, chapter: 999, from: 999, to: 999 })).toBe(true);
  });

  it('refuse un livre, un chapitre ou des versets hors bornes', () => {
    expect(isShowablePassage({ ...passage, book: 0 })).toBe(false);
    expect(isShowablePassage({ ...passage, book: 74 })).toBe(false);
    expect(isShowablePassage({ ...passage, chapter: 0 })).toBe(false);
    expect(isShowablePassage({ ...passage, from: 0 })).toBe(false);
    expect(isShowablePassage({ ...passage, from: 7, to: 6 })).toBe(false);
    expect(isShowablePassage({ ...passage, to: 1000 })).toBe(false);
    expect(isShowablePassage({ ...passage, chapter: 1.5 })).toBe(false);
  });
});

describe('readPassageRow', () => {
  it('lit une ligne du serveur', () => {
    expect(readPassageRow({ book: 19, chapter: 23, verse_from: 1, verse_to: 6 })).toEqual(passage);
    expect(readPassageRow({ book: '19', chapter: '23', verse_from: '1', verse_to: '6' })).toEqual(passage);
  });

  it('rejette les lignes invalides', () => {
    expect(readPassageRow(null)).toBeNull();
    expect(readPassageRow('x')).toBeNull();
    expect(readPassageRow({})).toBeNull();
    expect(readPassageRow({ book: 0, chapter: 1, verse_from: 1, verse_to: 1 })).toBeNull();
    expect(readPassageRow({ book: 74, chapter: 1, verse_from: 1, verse_to: 1 })).toBeNull();
    expect(readPassageRow({ book: 1, chapter: 1, verse_from: 5, verse_to: 4 })).toBeNull();
    expect(readPassageRow({ book: 1, chapter: 1, verse_from: 1.5, verse_to: 2 })).toBeNull();
    expect(readPassageRow({ book: 1, chapter: 1, verse_from: null, verse_to: 2 })).toBeNull();
    expect(readPassageRow({ book: 1, chapter: 1, verse_from: '', verse_to: 2 })).toBeNull();
  });
});

describe('readPrayerRow', () => {
  it('lit une prière', () => {
    expect(readPrayerRow({ prayer_id: 'perso-1', title: 'Ma prière', body: 'Seigneur,\n…' })).toEqual({
      id: 'perso-1',
      title: 'Ma prière',
      text: 'Seigneur,\n…',
    });
  });

  it('rejette une prière sans identifiant, titre ou texte, ou trop longue', () => {
    expect(readPrayerRow(null)).toBeNull();
    expect(readPrayerRow({ title: 'a', body: 'b' })).toBeNull();
    expect(readPrayerRow({ prayer_id: '', title: 'a', body: 'b' })).toBeNull();
    expect(readPrayerRow({ prayer_id: 'x', title: '  ', body: 'b' })).toBeNull();
    expect(readPrayerRow({ prayer_id: 'x', title: 'a', body: '' })).toBeNull();
    expect(readPrayerRow({ prayer_id: 'x', title: 'a'.repeat(81), body: 'b' })).toBeNull();
    expect(readPrayerRow({ prayer_id: 'x', title: 'a', body: 'b'.repeat(4001) })).toBeNull();
    expect(readPrayerRow({ prayer_id: 'x', title: 3, body: 'b' })).toBeNull();
  });
});

describe('readIntentionRow', () => {
  const row = { id: 'u1', body: 'Pour ma mère', created_at: '2026-01-01T00:00:00Z', mine: false, carries: 3, carrying: true };

  it('lit une intention', () => {
    expect(readIntentionRow(row)).toEqual({
      id: 'u1',
      body: 'Pour ma mère',
      createdAt: '2026-01-01T00:00:00Z',
      mine: false,
      carries: 3,
      carrying: true,
    });
  });

  it('rejette les lignes incomplètes ou mal typées', () => {
    expect(readIntentionRow(null)).toBeNull();
    expect(readIntentionRow({ ...row, id: 1 })).toBeNull();
    expect(readIntentionRow({ ...row, body: ' ' })).toBeNull();
    expect(readIntentionRow({ ...row, mine: 'oui' })).toBeNull();
    expect(readIntentionRow({ ...row, carrying: undefined })).toBeNull();
    expect(readIntentionRow({ ...row, carries: -1 })).toBeNull();
    expect(readIntentionRow({ ...row, carries: 'beaucoup' })).toBeNull();
  });
});

describe('readShowcase', () => {
  it('ignore les lignes invalides et garde les autres', () => {
    const showcase = readShowcase({
      passages: [{ book: 19, chapter: 23, verse_from: 1, verse_to: 6 }, { book: 0 }, 'x'],
      prayers: [{ prayer_id: 'a', title: 'T', body: 'B' }, { prayer_id: 'b' }],
      intentions: [{ id: 'u', body: 'x', created_at: 'd', mine: true, carries: 0, carrying: false }, null],
    });
    expect(showcase.passages).toEqual([passage]);
    expect(showcase.prayers).toHaveLength(1);
    expect(showcase.intentions).toHaveLength(1);
    expect(hasShowcase(showcase)).toBe(true);
  });

  it('renvoie une vitrine vide pour tout ce qui n’est pas un objet', () => {
    for (const bad of [null, undefined, 'x', 3, [], { passages: 'x', prayers: null }]) {
      const showcase = readShowcase(bad);
      expect(showcase).toEqual({ passages: [], prayers: [], intentions: [] });
      expect(hasShowcase(showcase)).toBe(false);
    }
  });
});

describe('removedKeys', () => {
  it('liste les passages qui ne sont plus gardés', () => {
    const a = { book: 1, chapter: 1, from: 1, to: 1 };
    const b = { book: 2, chapter: 2, from: 2, to: 3 };
    expect(removedKeys([a, b], [b])).toEqual(['1:1:1-1']);
    expect(removedKeys([a], [a, b])).toEqual([]);
    expect(removedKeys([], [a])).toEqual([]);
  });
});

describe('excerpt', () => {
  it('prend la première ligne non vide', () => {
    expect(excerpt('\n  Notre Père\nqui es aux cieux')).toBe('Notre Père');
  });

  it('coupe une ligne trop longue', () => {
    const cut = excerpt('a'.repeat(200), 20);
    expect(cut).toHaveLength(20);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('gère un texte vide', () => {
    expect(excerpt('')).toBe('');
  });
});
