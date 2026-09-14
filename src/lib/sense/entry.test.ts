import { describe, expect, it } from 'vitest';
import { normalizeEntryCandidate, wordEntrySchema } from './entry';
import { buildEntryMessages, entryCacheKey } from './entryPrompt';

function parse(candidate: unknown) {
  return wordEntrySchema.safeParse(normalizeEntryCandidate(candidate));
}

const minimal = {
  traductions: [
    {
      nature: 'verb',
      equivalents: ['retourner'],
      precision: null,
      registre: 'neutre',
      exemple: null,
    },
  ],
  expressions: [],
  piege: null,
};

describe('normalizeEntryCandidate', () => {
  it('accepts a well-formed entry unchanged', () => {
    const parsed = parse(minimal);
    expect(parsed.success).toBe(true);
  });

  it('accepts the French names a model answers with instead of the contract values', () => {
    const parsed = parse({
      ...minimal,
      traductions: [
        {
          nature: 'verbe',
          equivalents: ['retourner'],
          precision: null,
          registre: 'informal',
          exemple: null,
        },
        {
          nature: 'verbe à particule',
          equivalents: ['péter un câble'],
          precision: null,
          registre: 'slang',
          exemple: null,
        },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.traductions.map((sense) => [sense.nature, sense.registre])).toEqual([
      ['verb', 'familier'],
      ['phrasal verb', 'argot'],
    ]);
  });

  it('wraps a lone equivalent that came without its array', () => {
    const parsed = parse({
      ...minimal,
      traductions: [
        {
          nature: 'noun',
          equivalents: 'pichenette',
          precision: null,
          registre: 'neutre',
          exemple: null,
        },
      ],
    });

    expect(parsed.data?.traductions[0].equivalents).toEqual(['pichenette']);
  });

  it('treats "null", "none" and an empty string as nothing to report', () => {
    for (const value of ['null', 'None', '  ', 'aucun']) {
      const parsed = parse({ ...minimal, piege: value });
      expect(parsed.data?.piege).toBeNull();
    }
    expect(parse({ ...minimal, piege: 'Ne veut pas dire « actuellement ».' }).data?.piege).toBe(
      'Ne veut pas dire « actuellement ».'
    );
  });

  it('drops a half-written example rather than rejecting the whole entry', () => {
    const parsed = parse({
      ...minimal,
      traductions: [
        {
          nature: 'verb',
          equivalents: ['retourner'],
          precision: null,
          registre: 'neutre',
          exemple: { en: 'Flip it.' },
        },
      ],
      expressions: [{ en: 'flip out', fr: 'péter un câble' }, { en: 'flip off' }, 'n’importe quoi'],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.traductions[0].exemple).toBeNull();
    expect(parsed.data?.expressions).toEqual([{ en: 'flip out', fr: 'péter un câble' }]);
  });

  it('drops a sense with no equivalent at all, which would show an empty line', () => {
    const parsed = parse({
      ...minimal,
      traductions: [
        { nature: 'verb', equivalents: [], precision: null, registre: 'neutre', exemple: null },
        {
          nature: 'noun',
          equivalents: ['pichenette'],
          precision: null,
          registre: 'neutre',
          exemple: null,
        },
      ],
    });

    expect(parsed.data?.traductions).toHaveLength(1);
    expect(parsed.data?.traductions[0].equivalents).toEqual(['pichenette']);
  });

  it('refuses an entry that says nothing', () => {
    expect(parse({ traductions: [], expressions: [], piege: null }).success).toBe(false);
    expect(parse(null).success).toBe(false);
  });

  it('caps what the panel would have to show', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      nature: 'noun',
      equivalents: [`sens ${index}`],
      precision: null,
      registre: 'neutre',
      exemple: null,
    }));

    const parsed = parse({ traductions: many, expressions: [], piege: null });
    expect(parsed.data?.traductions).toHaveLength(6);
  });
});

describe('buildEntryMessages', () => {
  it('sends the word alone: the entry must not depend on a scene', () => {
    const messages = buildEntryMessages({ term: 'flip', language: 'fr' });
    const user = messages.at(-1)?.content ?? '';

    expect(user).toContain('"flip"');
    expect(user).not.toMatch(/SCENE|TITLE/);
  });

  it('asks for the output language actually chosen', () => {
    expect(buildEntryMessages({ term: 'flip', language: 'fr' })[0].content).toContain('French');
    expect(buildEntryMessages({ term: 'flip', language: 'en' })[0].content).toContain('English');
  });
});

describe('entryCacheKey', () => {
  it('ignores the case of the word, so "Flip" is not paid twice', () => {
    const lower = entryCacheKey({ term: 'flip', language: 'fr' }, 'm');
    expect(entryCacheKey({ term: 'Flip', language: 'fr' }, 'm')).toBe(lower);
  });

  it('separates the languages and the models', () => {
    const base = entryCacheKey({ term: 'flip', language: 'fr' }, 'm');
    expect(entryCacheKey({ term: 'flip', language: 'en' }, 'm')).not.toBe(base);
    expect(entryCacheKey({ term: 'flip', language: 'fr' }, 'autre')).not.toBe(base);
  });

  it('never collides with a contextual sense key', () => {
    expect(entryCacheKey({ term: 'flip', language: 'fr' }, 'm')).not.toBe(
      entryCacheKey({ term: 'entry', language: 'fr' }, 'm')
    );
  });
});
