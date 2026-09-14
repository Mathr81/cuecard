import { describe, expect, it, vi } from 'vitest';
import { isFormPointer, isFormPointerOnly } from './formOf';
import { lookupDictionary } from './lookup';
import { resolveProviderOrder } from './providers';
import type { DictionaryProvider } from './providers/types';
import { ProviderUnavailableError } from './providers/types';
import type { DictionaryEntry, DictionarySourceId } from './types';

function entry(word: string, definitions: string[]): DictionaryEntry {
  return {
    requested: word,
    word,
    phonetic: null,
    audio: null,
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: definitions.map((text) => ({ text, example: null, synonyms: [] })),
        synonyms: [],
      },
    ],
    source: { id: 'freedictionary', url: null, license: null },
  };
}

/** Une source qui rend ce qu'on lui a dit de rendre, en notant ce qu'on lui demande. */
function stubProvider(
  id: DictionarySourceId,
  answers: Record<string, DictionaryEntry | null | 'down'>,
  options: Partial<Pick<DictionaryProvider, 'supportsPhrases'>> = {}
) {
  const asked: string[] = [];
  const provider: DictionaryProvider = {
    id,
    supportsPhrases: options.supportsPhrases ?? true,
    timeoutMs: 1_000,
    lookup(word) {
      asked.push(word);
      const answer = answers[word] ?? null;
      if (answer === 'down') return Promise.reject(new ProviderUnavailableError(id, 'HTTP 503'));
      return Promise.resolve(answer);
    },
  };
  return { provider, asked };
}

const budget = () => AbortSignal.timeout(2_000);

describe('isFormPointer', () => {
  it('recognises the renvois Wiktionary puts in place of a definition', () => {
    expect(isFormPointer('plural of wolf')).toBe(true);
    expect(isFormPointer('simple past and past participle of flip')).toBe(true);
    expect(isFormPointer('present participle and gerund of run')).toBe(true);
    expect(isFormPointer('comparative degree of good and well')).toBe(true);
    expect(isFormPointer('third-person singular simple present indicative of run')).toBe(true);
    expect(isFormPointer('alternative spelling of colour')).toBe(true);
  });

  it('leaves real definitions that merely contain "of" alone', () => {
    expect(isFormPointer('A form of government in which power is held by the people.')).toBe(false);
    expect(isFormPointer('A complete change of direction, decision, movement etc.')).toBe(false);
    expect(isFormPointer('To think about the past of a person.')).toBe(false);
    expect(isFormPointer('Being indicative of a wider trend.')).toBe(false);
  });

  it('only calls an entry a pointer when every definition is one', () => {
    expect(isFormPointerOnly(entry('wolves', ['plural of wolf']))).toBe(true);
    expect(
      isFormPointerOnly(entry('running', ['present participle of run', 'The action of running.']))
    ).toBe(false);
    expect(isFormPointerOnly(entry('flip', []))).toBe(false);
  });
});

describe('resolveProviderOrder', () => {
  it('puts the most reliable source first by default', () => {
    expect(resolveProviderOrder(null).map((provider) => provider.id)).toEqual([
      'freedictionary',
      'datamuse',
      'dictionaryapi',
    ]);
  });

  it('honours the order asked for, once each', () => {
    expect(resolveProviderOrder('datamuse, freedictionary ,datamuse').map((p) => p.id)).toEqual([
      'datamuse',
      'freedictionary',
    ]);
  });

  it('ignores an unknown name rather than leaving the app without a dictionary', () => {
    expect(resolveProviderOrder('datamuse,wiktionnaire').map((p) => p.id)).toEqual(['datamuse']);
    expect(resolveProviderOrder('nimportequoi').map((p) => p.id)).toEqual([
      'freedictionary',
      'datamuse',
      'dictionaryapi',
    ]);
  });
});

describe('lookupDictionary', () => {
  it('stops at the first source that answers', async () => {
    const first = stubProvider('freedictionary', { flip: entry('flip', ['To turn over.']) });
    const second = stubProvider('datamuse', { flip: entry('flip', ['Autre chose.']) });

    const result = await lookupDictionary('flip', {
      budget: budget(),
      providers: [first.provider, second.provider],
    });

    expect(result).toMatchObject({ status: 'found', entry: { word: 'flip' } });
    expect(second.asked).toEqual([]);
  });

  it('falls through to the next source when one is down', async () => {
    const down = stubProvider('freedictionary', { flip: 'down' });
    const up = stubProvider('datamuse', { flip: entry('flip', ['To turn over.']) });

    const result = await lookupDictionary('flip', {
      budget: budget(),
      providers: [down.provider, up.provider],
    });

    expect(result.status).toBe('found');
    expect(up.asked).toEqual(['flip']);
  });

  it('does not keep trying other forms on a source that just failed', async () => {
    const down = stubProvider('freedictionary', { wolves: 'down' });

    await lookupDictionary('wolves', { budget: budget(), providers: [down.provider] });

    expect(down.asked).toEqual(['wolves']);
  });

  it('follows a "plural of wolf" through to the base form', async () => {
    const source = stubProvider('freedictionary', {
      wolves: entry('wolves', ['plural of wolf']),
      wolf: entry('wolf', ['A carnivorous mammal.']),
    });

    const result = await lookupDictionary('wolves', {
      budget: budget(),
      providers: [source.provider],
    });

    expect(result).toMatchObject({
      status: 'found',
      entry: { word: 'wolf', requested: 'wolves' },
    });
  });

  it('keeps the renvoi rather than nothing when no base form is found', async () => {
    const source = stubProvider('freedictionary', { wolves: entry('wolves', ['plural of wolf']) });

    const result = await lookupDictionary('wolves', {
      budget: budget(),
      providers: [source.provider],
    });

    expect(result).toMatchObject({ status: 'found', entry: { word: 'wolves' } });
  });

  it('keeps the typed word alongside the form actually found', async () => {
    const source = stubProvider('freedictionary', { run: entry('run', ['To move swiftly.']) });

    const result = await lookupDictionary('running', {
      budget: budget(),
      providers: [source.provider],
    });

    expect(result).toMatchObject({ status: 'found', entry: { word: 'run', requested: 'running' } });
  });

  it('spares a source that does not index expressions', async () => {
    const wordsOnly = stubProvider('dictionaryapi', {}, { supportsPhrases: false });
    const phrases = stubProvider('freedictionary', {
      'pull off': entry('pull off', ['To achieve.']),
    });

    const result = await lookupDictionary('pull off', {
      budget: budget(),
      providers: [wordsOnly.provider, phrases.provider],
    });

    expect(result.status).toBe('found');
    expect(wordsOnly.asked).toEqual([]);
  });

  it('reports a missing word once a source has answered', async () => {
    const source = stubProvider('freedictionary', {});

    const result = await lookupDictionary('zzzqqx', {
      budget: budget(),
      providers: [source.provider],
    });

    expect(result).toEqual({ status: 'not_found' });
  });

  it('stops after two firm "unknown" rather than waiting on the slowest source', async () => {
    const first = stubProvider('freedictionary', {});
    const second = stubProvider('datamuse', {});
    const slowest = stubProvider('dictionaryapi', {});

    const result = await lookupDictionary('zzzqqx', {
      budget: budget(),
      providers: [first.provider, second.provider, slowest.provider],
    });

    expect(result).toEqual({ status: 'not_found' });
    expect(slowest.asked).toEqual([]);
  });

  it('still falls back to the last source when the first two broke down', async () => {
    const first = stubProvider('freedictionary', { flip: 'down' });
    const second = stubProvider('datamuse', { flip: 'down' });
    const last = stubProvider('dictionaryapi', { flip: entry('flip', ['To turn over.']) });

    const result = await lookupDictionary('flip', {
      budget: budget(),
      providers: [first.provider, second.provider, last.provider],
    });

    expect(result.status).toBe('found');
    expect(last.asked).toEqual(['flip']);
  });

  it('reports a breakdown, with the reasons, when no source answers at all', async () => {
    const first = stubProvider('freedictionary', { flip: 'down' });
    const second = stubProvider('datamuse', { flip: 'down' });

    const result = await lookupDictionary('flip', {
      budget: budget(),
      providers: [first.provider, second.provider],
    });

    expect(result).toEqual({
      status: 'unavailable',
      failures: ['freedictionary: HTTP 503', 'datamuse: HTTP 503'],
    });
  });

  it('gives up on an exhausted budget instead of piling up calls', async () => {
    const source = stubProvider('freedictionary', {});
    const spent = AbortSignal.abort();

    const result = await lookupDictionary('wolves', {
      budget: spent,
      providers: [source.provider],
    });

    expect(source.asked).toEqual([]);
    expect(result.status).toBe('unavailable');
  });
});

describe('providers', () => {
  async function withFetch<T>(body: unknown, status: number, run: () => Promise<T>): Promise<T> {
    const stub = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status }) as Response);
    vi.stubGlobal('fetch', stub);
    try {
      return await run();
    } finally {
      vi.unstubAllGlobals();
    }
  }

  it('reads freedictionaryapi: phonetics, examples and licence', async () => {
    const { freeDictionaryProvider } = await import('./providers/freedictionary');
    const payload = {
      word: 'flip',
      entries: [
        {
          language: { code: 'en' },
          partOfSpeech: 'noun',
          pronunciations: [{ type: 'ipa', text: '/flɪp/' }],
          senses: [{ definition: 'A maneuver.', examples: ['A flip of a coin.'], synonyms: [] }],
        },
        {
          language: { code: 'fr' },
          partOfSpeech: 'nom',
          senses: [{ definition: 'Ne doit pas apparaître.' }],
        },
        {
          language: { code: 'en' },
          partOfSpeech: 'verb',
          senses: [{ definition: 'To throw so as to turn over.' }],
        },
      ],
      source: { url: 'https://en.wiktionary.org/wiki/flip', license: { name: 'CC BY-SA 4.0' } },
    };

    const result = await withFetch(payload, 200, () =>
      freeDictionaryProvider.lookup('flip', AbortSignal.timeout(1_000))
    );

    expect(result).toMatchObject({
      word: 'flip',
      phonetic: '/flɪp/',
      source: { id: 'freedictionary', license: 'CC BY-SA 4.0' },
    });
    expect(result?.meanings.map((meaning) => meaning.partOfSpeech)).toEqual(['noun', 'verb']);
    expect(result?.meanings[0].definitions[0].example).toBe('A flip of a coin.');
  });

  it('treats an empty freedictionaryapi payload as a missing word, not a breakdown', async () => {
    const { freeDictionaryProvider } = await import('./providers/freedictionary');

    const result = await withFetch({ word: 'zzz', entries: [] }, 200, () =>
      freeDictionaryProvider.lookup('zzz', AbortSignal.timeout(1_000))
    );

    expect(result).toBeNull();
  });

  it('splits the part of speech Datamuse tabs onto each definition', async () => {
    const { datamuseProvider } = await import('./providers/datamuse');
    const payload = [
      { word: 'flip', defs: ['n\tA maneuver. ', 'v\tTo turn over.', 'u\tSans nature connue.'] },
    ];

    const result = await withFetch(payload, 200, () =>
      datamuseProvider.lookup('flip', AbortSignal.timeout(1_000))
    );

    expect(result?.meanings.map((meaning) => meaning.partOfSpeech)).toEqual(['noun', 'verb']);
    expect(result?.meanings[0].definitions[0].text).toBe('A maneuver.');
  });

  it('refuses a Datamuse neighbour that is not the word asked for', async () => {
    const { datamuseProvider } = await import('./providers/datamuse');

    const result = await withFetch([{ word: 'flap', defs: ['n\tAutre mot.'] }], 200, () =>
      datamuseProvider.lookup('flip', AbortSignal.timeout(1_000))
    );

    expect(result).toBeNull();
  });

  it('turns a 5xx into a breakdown so the next source gets its turn', async () => {
    const { datamuseProvider } = await import('./providers/datamuse');

    await expect(
      withFetch({}, 503, () => datamuseProvider.lookup('flip', AbortSignal.timeout(1_000)))
    ).rejects.toThrow(ProviderUnavailableError);
  });
});
