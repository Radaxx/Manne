import { ownerDecision, readOwner } from '../src/auth/owner';

const A = { userId: 'a', linked: true };
const B = { userId: 'b', linked: true };
const anon = (userId: string) => ({ userId, linked: false });

describe('ownerDecision', () => {
  it('même utilisateur : rien à effacer', () => {
    expect(ownerDecision(A, A)).toEqual({ reset: false, next: A });
  });

  it('anonyme qui se relie (même utilisateur) : on garde, le propriétaire devient relié', () => {
    expect(ownerDecision(anon('x'), { userId: 'x', linked: true })).toEqual({ reset: false, next: { userId: 'x', linked: true } });
  });

  it('anonyme qui se connecte à un compte existant (reprise) : on garde', () => {
    expect(ownerDecision(anon('x'), B).reset).toBe(false);
  });

  it('premier lancement, rien d’enregistré : on garde et on enregistre', () => {
    expect(ownerDecision(null, A)).toEqual({ reset: false, next: A });
  });

  it('compte relié A puis session anonyme neuve : on efface', () => {
    expect(ownerDecision(A, anon('x'))).toEqual({ reset: true, next: anon('x') });
  });

  it('compte relié A puis compte relié B : on efface', () => {
    expect(ownerDecision(A, B)).toEqual({ reset: true, next: B });
  });

  it('anonyme puis autre anonyme : rien de privé à protéger', () => {
    expect(ownerDecision(anon('x'), anon('y')).reset).toBe(false);
  });
});

describe('readOwner', () => {
  it('refuse ce qui est mal formé', () => {
    expect(readOwner({ userId: 'a', linked: true })).toEqual(A);
    expect(readOwner({ userId: '', linked: true })).toBeNull();
    expect(readOwner({ userId: 'a', linked: 'oui' })).toBeNull();
    expect(readOwner(null)).toBeNull();
    expect(readOwner('x')).toBeNull();
  });
});
