import { fontFace, resolveText, SERIF_FAMILY } from '../src/fonts';

describe('fontFace', () => {
  it('choisit la graisse de Figtree', () => {
    expect(fontFace('sans', undefined, false)).toBe('Figtree_400Regular');
    expect(fontFace('sans', 'normal', false)).toBe('Figtree_400Regular');
    expect(fontFace('sans', '500', false)).toBe('Figtree_500Medium');
    expect(fontFace('sans', '600', false)).toBe('Figtree_600SemiBold');
    expect(fontFace('sans', '700', false)).toBe('Figtree_700Bold');
    expect(fontFace('sans', 'bold', false)).toBe('Figtree_700Bold');
    expect(fontFace('sans', '800', false)).toBe('Figtree_800ExtraBold');
    expect(fontFace('sans', '900', false)).toBe('Figtree_800ExtraBold');
  });

  it('choisit le gras et l’italique de Newsreader', () => {
    expect(fontFace('serif', undefined, false)).toBe('Newsreader_400Regular');
    expect(fontFace('serif', '700', false)).toBe('Newsreader_700Bold');
    expect(fontFace('serif', undefined, true)).toBe('Newsreader_400Regular_Italic');
    expect(fontFace('serif', '700', true)).toBe('Newsreader_700Bold_Italic');
  });

  it('prend l’italique de Figtree le plus proche', () => {
    expect(fontFace('sans', '400', true)).toBe('Figtree_400Regular_Italic');
    expect(fontFace('sans', '800', true)).toBe('Figtree_700Bold_Italic');
  });
});

describe('resolveText', () => {
  it('met Figtree par défaut', () => {
    expect(resolveText({}, null)).toEqual({ base: 'sans', face: 'Figtree_400Regular' });
    expect(resolveText(undefined, null)).toEqual({ base: 'sans', face: 'Figtree_400Regular' });
    expect(resolveText({ fontWeight: '800' }, null)).toEqual({ base: 'sans', face: 'Figtree_800ExtraBold' });
  });

  it('met Newsreader pour le serif, avec sa graisse et son italique', () => {
    expect(resolveText({ fontFamily: SERIF_FAMILY }, null)).toEqual({ base: 'serif', face: 'Newsreader_400Regular' });
    expect(resolveText({ fontFamily: SERIF_FAMILY, fontWeight: '700' }, null)).toEqual({ base: 'serif', face: 'Newsreader_700Bold' });
    expect(resolveText({ fontFamily: SERIF_FAMILY, fontStyle: 'italic' }, null)).toEqual({
      base: 'serif',
      face: 'Newsreader_400Regular_Italic',
    });
  });

  it('laisse un texte emboîté hériter de son parent', () => {
    expect(resolveText({}, 'serif')).toBeNull();
    expect(resolveText({ fontWeight: '700' }, 'serif')).toEqual({ base: 'serif', face: 'Newsreader_700Bold' });
    expect(resolveText({ fontStyle: 'italic' }, 'sans')).toEqual({ base: 'sans', face: 'Figtree_400Regular_Italic' });
  });

  it('revient au texte courant quand fontFamily est mis à undefined dans un serif', () => {
    expect(resolveText({ fontFamily: undefined, fontWeight: '700' }, 'serif')).toEqual({ base: 'sans', face: 'Figtree_700Bold' });
  });

  it('ne touche pas à une autre police demandée', () => {
    expect(resolveText({ fontFamily: 'Courier' }, null)).toBeNull();
  });
});
