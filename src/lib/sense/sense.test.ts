import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMessages, senseCacheKey, type SenseRequest } from './prompt';
import { extractJsonObject, normalizeSenseCandidate, senseSchema } from './schema';
import { sceneAround } from './context';
import { requestSense } from '@/lib/openrouter/client';

const request: SenseRequest = {
  term: 'blow this off',
  lines: [
    "I'm not gonna let you down, all right?",
    "You've said that before, Frank.",
    'Yeah, well, this time I mean it.',
    "Look, we can't just blow this off and hope nobody notices.",
    '- Says who? - Says the guy with the badge.',
  ],
  targetIndex: 3,
  title: 'Breaking Bad',
  year: 2008,
  genres: ['Crime', 'Drame'],
  language: 'fr',
};

const valid = {
  traduction_contextuelle: 'laisser tomber ça',
  explication: "Ici, « blow off » veut dire ignorer un problème au lieu de l'affronter.",
  registre: 'familier',
  type: 'phrasal verb',
  note_culturelle: null,
  exemples: [{ en: 'He blew off the meeting.', fr: 'Il a séché la réunion.' }],
};

describe('buildMessages', () => {
  it('marks the line to explain so the model targets the right occurrence', () => {
    const [, user] = buildMessages(request);
    expect(user.content).toContain(">> Look, we can't just blow this off");
    expect(user.content).toContain("   You've said that before");
  });

  it('passes the title, year and genres', () => {
    const [, user] = buildMessages(request);
    expect(user.content).toContain('TITLE: Breaking Bad (2008)');
    expect(user.content).toContain('GENRES: Crime, Drame');
  });

  it('asks for the chosen output language', () => {
    expect(buildMessages(request)[0].content).toContain('in French');
    expect(buildMessages({ ...request, language: 'en' })[0].content).toContain('in English');
  });

  it('quotes the expression so a multi-word term stays whole', () => {
    expect(buildMessages(request)[1].content).toContain('"blow this off"');
  });
});

describe('senseCacheKey', () => {
  it('is stable for the same word in the same scene', () => {
    expect(senseCacheKey(request, 'm')).toBe(senseCacheKey({ ...request }, 'm'));
  });

  it('changes with the term, the scene, the language and the model', () => {
    const base = senseCacheKey(request, 'm');
    expect(senseCacheKey({ ...request, term: 'badge' }, 'm')).not.toBe(base);
    expect(senseCacheKey({ ...request, language: 'en' }, 'm')).not.toBe(base);
    expect(senseCacheKey({ ...request, targetIndex: 2 }, 'm')).not.toBe(base);
    expect(senseCacheKey(request, 'other')).not.toBe(base);
  });
});

describe('extractJsonObject', () => {
  it('reads a bare object', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('unwraps a markdown fence', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('ignores chatter around the object', () => {
    expect(extractJsonObject('Sure! {"a":1} Hope this helps.')).toEqual({ a: 1 });
  });

  it('returns null when there is no object at all', () => {
    expect(extractJsonObject('I cannot help with that.')).toBeNull();
    expect(extractJsonObject('{not json}')).toBeNull();
  });
});

describe('normalizeSenseCandidate', () => {
  it('accepts English spellings of the enums', () => {
    const normalized = normalizeSenseCandidate({
      ...valid,
      registre: 'Informal',
      type: 'Phrasal Verb',
    });
    expect(senseSchema.parse(normalized)).toMatchObject({
      registre: 'familier',
      type: 'phrasal verb',
    });
  });

  it('accepts an unaccented type', () => {
    const normalized = normalizeSenseCandidate({ ...valid, type: 'litteral' });
    expect(senseSchema.parse(normalized).type).toBe('littéral');
  });

  it('turns an empty or literal "null" cultural note into null', () => {
    for (const note of ['', '   ', 'null', 'None']) {
      const normalized = normalizeSenseCandidate({ ...valid, note_culturelle: note });
      expect(senseSchema.parse(normalized).note_culturelle).toBeNull();
    }
  });

  it('fills in a missing cultural note', () => {
    const withoutNote: Record<string, unknown> = { ...valid };
    delete withoutNote.note_culturelle;
    expect(senseSchema.parse(normalizeSenseCandidate(withoutNote)).note_culturelle).toBeNull();
  });

  it('drops incomplete examples and caps them at three', () => {
    const normalized = normalizeSenseCandidate({
      ...valid,
      exemples: [
        { en: 'a', fr: 'a' },
        { en: 'b' },
        { en: 'c', fr: '  ' },
        { en: 'd', fr: 'd' },
        { en: 'e', fr: 'e' },
        { en: 'f', fr: 'f' },
      ],
    });
    expect(senseSchema.parse(normalized).exemples).toHaveLength(3);
  });

  it('leaves a value it cannot map alone, so validation still rejects it', () => {
    const normalized = normalizeSenseCandidate({ ...valid, registre: 'poetic' });
    expect(senseSchema.safeParse(normalized).success).toBe(false);
  });
});

describe('requestSense', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function completion(content: string, tokens = 100) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content } }],
        usage: { prompt_tokens: tokens, completion_tokens: 20, total_tokens: tokens + 20 },
        model: 'test/model',
      }),
      text: async () => '',
    } as unknown as Response;
  }

  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
    vi.stubEnv('OPENROUTER_MODEL', 'test/model');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns the sense and the tokens it cost', async () => {
    fetchMock.mockResolvedValue(completion(JSON.stringify(valid)));
    const result = await requestSense(request);

    expect(result.attempts).toBe(1);
    expect(result.sense.traduction_contextuelle).toBe('laisser tomber ça');
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120 });
  });

  it('asks the model for JSON and keeps the temperature low', async () => {
    fetchMock.mockResolvedValue(completion(JSON.stringify(valid)));
    await requestSense(request);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.model).toBe('test/model');
    expect(body.temperature).toBeLessThanOrEqual(0.3);
  });

  it('retries once when the answer breaks the contract, and counts both calls', async () => {
    fetchMock
      .mockResolvedValueOnce(completion('Sorry, I cannot do that.', 100))
      .mockResolvedValueOnce(completion(JSON.stringify(valid), 150));

    const result = await requestSense(request);
    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.usage.totalTokens).toBe(120 + 170);

    const retryBody = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(retryBody.messages.at(-1).content).toMatch(/rejected/);
  });

  it('gives up after the second failure instead of looping', async () => {
    fetchMock.mockResolvedValue(completion('nope'));
    await expect(requestSense(request)).rejects.toMatchObject({ code: 'invalid_response' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a missing key without calling anything', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    await expect(requestSense(request)).rejects.toMatchObject({ code: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sceneAround', () => {
  const cues = Array.from({ length: 10 }, (_, index) => ({
    index,
    startMs: index * 1000,
    endMs: index * 1000 + 900,
    text: `line ${index}`,
  }));

  it('takes four lines on each side', () => {
    const scene = sceneAround(cues, 5);
    expect(scene.lines).toHaveLength(9);
    expect(scene.lines[scene.targetIndex]).toBe('line 5');
  });

  it('clamps at the start of the file without shifting the target', () => {
    const scene = sceneAround(cues, 1);
    expect(scene.lines[0]).toBe('line 0');
    expect(scene.lines[scene.targetIndex]).toBe('line 1');
  });

  it('clamps at the end of the file', () => {
    const scene = sceneAround(cues, 9);
    expect(scene.lines.at(-1)).toBe('line 9');
    expect(scene.lines[scene.targetIndex]).toBe('line 9');
  });

  it('flattens the line breaks a cue may contain', () => {
    const scene = sceneAround([{ index: 0, startMs: 0, endMs: 1, text: 'a\nb' }], 0);
    expect(scene.lines).toEqual(['a b']);
  });
});
