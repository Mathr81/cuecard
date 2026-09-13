import { describe, expect, it } from 'vitest';
import { candidateForms } from './lemma';
import { normalizeDictionaryResponse } from './normalize';
import { externalLinks } from './links';

describe('candidateForms', () => {
  it('keeps the typed word first', () => {
    expect(candidateForms('Run')[0]).toBe('run');
  });

  it('undoes the -ing form, including the doubled consonant and the dropped e', () => {
    expect(candidateForms('running')).toContain('run');
    expect(candidateForms('making')).toContain('make');
  });

  it('undoes the -ed form', () => {
    expect(candidateForms('stopped')).toContain('stop');
    expect(candidateForms('tried')).toContain('try');
  });

  it('handles plurals, including irregular ones', () => {
    expect(candidateForms('badges')).toContain('badge');
    expect(candidateForms('stories')).toContain('story');
    expect(candidateForms('wolves')).toContain('wolf');
  });

  it('strips the possessive', () => {
    expect(candidateForms("Frank's")).toContain('frank');
  });

  it('never proposes more than four network calls', () => {
    expect(candidateForms('stopped').length).toBeLessThanOrEqual(4);
  });

  it('leaves short words and contractions alone', () => {
    expect(candidateForms("don't")).toEqual(["don't"]);
    expect(candidateForms('is')).toEqual(['is']);
  });
});

describe('normalizeDictionaryResponse', () => {
  const payload = [
    {
      word: 'let',
      phonetic: '/lɛt/',
      phonetics: [
        { text: '/lɛt/', audio: '' },
        { text: '/lɛt/', audio: 'https://example.test/let-uk.mp3' },
        { text: '/lɛt/', audio: 'https://example.test/let-us.mp3' },
      ],
      meanings: [
        {
          partOfSpeech: 'verb',
          definitions: [
            { definition: 'To allow to', example: 'Let me go', synonyms: ['allow', 'allow'] },
            { definition: 'To allow to', example: null },
          ],
          synonyms: ['permit'],
        },
      ],
      sourceUrls: ['https://en.wiktionary.org/wiki/let'],
    },
    {
      word: 'let',
      meanings: [
        {
          partOfSpeech: 'Verb',
          definitions: [{ definition: 'To put up for rent' }],
        },
        {
          partOfSpeech: 'noun',
          definitions: [{ definition: 'A period of rental' }],
        },
      ],
    },
  ];

  it('groups meanings by part of speech across entries', () => {
    const entry = normalizeDictionaryResponse(payload, 'letting');
    expect(entry?.meanings.map((m) => m.partOfSpeech)).toEqual(['verb', 'noun']);
    expect(entry?.meanings[0].definitions).toHaveLength(2);
  });

  it('keeps the requested word alongside the form actually found', () => {
    const entry = normalizeDictionaryResponse(payload, 'letting');
    expect(entry).toMatchObject({ requested: 'letting', word: 'let' });
  });

  it('prefers the American recording and ignores empty audio', () => {
    expect(normalizeDictionaryResponse(payload, 'let')?.audio).toEqual({
      url: 'https://example.test/let-us.mp3',
      accent: 'us',
    });
  });

  it('deduplicates definitions and synonyms', () => {
    const entry = normalizeDictionaryResponse(payload, 'let');
    expect(entry?.meanings[0].definitions[0].synonyms).toEqual(['allow']);
  });

  it('rejects a payload that does not match the expected shape', () => {
    expect(normalizeDictionaryResponse({ message: 'No Definitions Found' }, 'zzz')).toBeNull();
    expect(normalizeDictionaryResponse([], 'zzz')).toBeNull();
  });

  it('rejects an entry whose meanings are all empty', () => {
    const empty = [{ word: 'x', meanings: [{ partOfSpeech: 'noun', definitions: [] }] }];
    expect(normalizeDictionaryResponse(empty, 'x')).toBeNull();
  });
});

describe('externalLinks', () => {
  it('builds a WordReference EN→FR link and underscores the Wiktionary expression', () => {
    const links = externalLinks('Give Up');
    expect(links.find((l) => l.id === 'wordreference')?.href).toBe(
      'https://www.wordreference.com/enfr/give%20up'
    );
    expect(links.find((l) => l.id === 'wiktionary')?.href).toBe(
      'https://en.wiktionary.org/wiki/give_up'
    );
  });
});
