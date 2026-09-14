import { afterEach, describe, expect, it, vi } from 'vitest';
import { envOr, optionalEnv } from './env';

afterEach(() => vi.unstubAllEnvs());

describe('optionalEnv', () => {
  it('rend la valeur quand elle est renseignée', () => {
    vi.stubEnv('CUECARD_TEST', 'https://exemple.test');
    expect(optionalEnv('CUECARD_TEST')).toBe('https://exemple.test');
  });

  it('traite une variable vide comme absente', () => {
    // `docker compose` transmet `FOO=` tel quel : c'est le cas qui cassait
    // l'URL du dictionnaire.
    vi.stubEnv('CUECARD_TEST', '');
    expect(optionalEnv('CUECARD_TEST')).toBeNull();
  });

  it('traite une variable blanche comme absente, et taille les espaces', () => {
    vi.stubEnv('CUECARD_TEST', '   ');
    expect(optionalEnv('CUECARD_TEST')).toBeNull();

    vi.stubEnv('CUECARD_TEST', '  valeur  ');
    expect(optionalEnv('CUECARD_TEST')).toBe('valeur');
  });

  it('rend null quand la variable n’existe pas', () => {
    expect(optionalEnv('CUECARD_ABSENTE')).toBeNull();
  });
});

describe('envOr', () => {
  it('retombe sur le défaut pour une variable vide comme pour une absente', () => {
    vi.stubEnv('CUECARD_TEST', '');
    expect(envOr('CUECARD_TEST', 'défaut')).toBe('défaut');
    expect(envOr('CUECARD_ABSENTE', 'défaut')).toBe('défaut');
  });
});
