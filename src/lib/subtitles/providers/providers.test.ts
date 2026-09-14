import { describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import {
  buildSearchUrl as buildOpenSubtitlesUrl,
  mapEntries as mapOpenSubtitlesEntries,
  normalizeImdbId,
  openSubtitlesProvider,
} from './opensubtitles';
import { buildSearchUrl as buildSheguUrl, mapEntries as mapSheguEntries } from './shegu';
import { decompressIfGzipped, searchSubtitles } from './index';
import type { SubtitleCandidate, SubtitleLookup, SubtitleProvider } from './types';

const movie: SubtitleLookup = {
  mediaType: 'movie',
  tmdbId: 603,
  imdbId: 'tt0133093',
  season: null,
  episode: null,
};

const episode: SubtitleLookup = {
  mediaType: 'tv',
  tmdbId: 1396,
  imdbId: 'tt0903747',
  season: 1,
  episode: 4,
};

describe('normalizeImdbId', () => {
  it('strips the tt prefix the API does not want', () => {
    expect(normalizeImdbId('tt0133093')).toBe('0133093');
    expect(normalizeImdbId('0133093')).toBe('0133093');
  });

  it('rejects anything that is not an IMDb id', () => {
    expect(normalizeImdbId(null)).toBeNull();
    expect(normalizeImdbId('')).toBeNull();
    expect(normalizeImdbId('nm0000206')).toBeNull();
  });
});

describe('OpenSubtitles sans clé', () => {
  it('filtre la langue côté serveur, sinon les cent premiers résultats noient l’anglais', () => {
    expect(buildOpenSubtitlesUrl(movie)).toBe(
      'https://rest.opensubtitles.org/search/imdbid-0133093/sublanguageid-eng'
    );
  });

  it('construit l’URL d’un épisode', () => {
    expect(buildOpenSubtitlesUrl(episode)).toBe(
      'https://rest.opensubtitles.org/search/episode-4/imdbid-0903747/season-1/sublanguageid-eng'
    );
  });

  it('ne cherche pas sans identifiant IMDb', () => {
    expect(buildOpenSubtitlesUrl({ ...movie, imdbId: null })).toBeNull();
  });

  it('ne cherche pas une série dont on ignore l’épisode', () => {
    expect(buildOpenSubtitlesUrl({ ...episode, episode: null })).toBeNull();
  });

  it('retient le nom de release, le compteur et le gzip', () => {
    const [candidate] = mapOpenSubtitlesEntries([
      {
        IDSubtitleFile: '45899',
        SubFileName: 'The.Matrix.1999.720p.srt',
        SubFormat: 'srt',
        SubDownloadsCnt: '562320',
        SubDownloadLink: 'https://dl.opensubtitles.org/x.gz',
      },
    ]);

    expect(candidate).toEqual({
      id: 'opensubtitles:45899',
      provider: 'opensubtitles',
      releaseName: 'The.Matrix.1999.720p.srt',
      url: 'https://dl.opensubtitles.org/x.gz',
      format: 'srt',
      encoding: 'gzip',
      downloadCount: 562320,
    });
  });

  it('écarte les formats que le parseur ne lit pas, et garde ceux qu’il lit', () => {
    const entries = [
      { SubFormat: 'ass', SubDownloadLink: 'https://x/1.gz' },
      { SubFormat: 'sub', SubDownloadLink: 'https://x/2.gz' },
      { SubFormat: 'vtt', SubDownloadLink: 'https://x/3.gz' },
      { SubDownloadLink: 'https://x/4.gz' },
    ];
    expect(mapOpenSubtitlesEntries(entries).map((c) => c.format)).toEqual(['vtt', 'srt']);
  });

  it('ignore une entrée sans lien de téléchargement', () => {
    expect(mapOpenSubtitlesEntries([{ SubFileName: 'x.srt' }])).toEqual([]);
    expect(mapOpenSubtitlesEntries({ message: 'nope' })).toEqual([]);
  });

  it('envoie le User-Agent qu’exige l’API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    await openSubtitlesProvider.search(movie);
    expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toMatch(/cuecard/);

    vi.unstubAllGlobals();
  });
});

describe('shegu', () => {
  it('interroge directement par identifiant TMDB, sans passer par l’IMDb', () => {
    expect(buildSheguUrl({ ...movie, imdbId: null })).toBe(
      'https://subtitles.shegu.st/subtitles?type=movie&tmdb=603'
    );
    expect(buildSheguUrl(episode)).toBe(
      'https://subtitles.shegu.st/subtitles?type=tv&tmdb=1396&season=1&episode=4'
    );
  });

  it('ne garde que l’anglais parmi toutes les langues renvoyées', () => {
    const candidates = mapSheguEntries({
      subtitles: [
        { id: 'a', language: 'de', url: 'https://s/1', type: 'srt', display: 'German' },
        {
          id: 'b',
          language: 'en',
          url: 'https://s/2',
          type: 'srt',
          display: 'English (orpheus)',
          source: 'opensubs',
        },
        { id: 'c', language: 'EN', url: 'https://s/3', type: 'srt', display: 'English' },
      ],
    });

    expect(candidates.map((c) => c.id)).toEqual(['shegu:b', 'shegu:c']);
    expect(candidates[0]).toMatchObject({
      releaseName: 'English (orpheus) · opensubs',
      encoding: 'plain',
      downloadCount: null,
    });
  });

  it('écarte les formats non gérés et les entrées incomplètes', () => {
    const candidates = mapSheguEntries({
      subtitles: [
        { language: 'en', url: 'https://s/1', type: 'ass' },
        { language: 'en', type: 'srt' },
        { language: 'en', url: 'https://s/3', type: 'vtt' },
      ],
    });
    expect(candidates.map((c) => c.url)).toEqual(['https://s/3']);
  });

  it('encaisse une réponse qui n’a pas la forme attendue', () => {
    expect(mapSheguEntries(null)).toEqual([]);
    expect(mapSheguEntries({ subtitles: 'nope' })).toEqual([]);
  });
});

describe('searchSubtitles', () => {
  function provider(
    id: SubtitleProvider['id'],
    result: SubtitleCandidate[] | Error
  ): SubtitleProvider {
    return {
      id,
      search: async () => {
        if (result instanceof Error) throw result;
        return result;
      },
    };
  }

  function candidate(overrides: Partial<SubtitleCandidate>): SubtitleCandidate {
    return {
      id: 'x',
      provider: 'opensubtitles',
      releaseName: 'x',
      url: 'https://x/1',
      format: 'srt',
      encoding: 'gzip',
      downloadCount: null,
      ...overrides,
    };
  }

  it('classe par nombre de téléchargements, ceux qui n’en ont pas à la fin', async () => {
    const { candidates } = await searchSubtitles(movie, [
      provider('opensubtitles', [
        candidate({ id: 'a', url: 'https://x/a', downloadCount: 10 }),
        candidate({ id: 'b', url: 'https://x/b', downloadCount: 900 }),
      ]),
      provider('shegu', [candidate({ id: 'c', url: 'https://x/c', provider: 'shegu' })]),
    ]);

    expect(candidates.map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('garde une place à shegu, que ses résultats sans compteur perdraient toujours', async () => {
    // Huit résultats OpenSubtitles mieux notés : sans réservation, aucun shegu
    // n'atteindrait la liste.
    const fromOpenSubtitles = Array.from({ length: 8 }, (_, index) =>
      candidate({ id: `os${index}`, url: `https://x/os${index}`, downloadCount: 900 - index })
    );
    const fromShegu = Array.from({ length: 3 }, (_, index) =>
      candidate({ id: `sh${index}`, url: `https://x/sh${index}`, provider: 'shegu' })
    );

    const { candidates } = await searchSubtitles(movie, [
      provider('opensubtitles', fromOpenSubtitles),
      provider('shegu', fromShegu),
    ]);

    expect(candidates).toHaveLength(6);
    expect(candidates.filter((c) => c.provider === 'shegu')).toHaveLength(2);
    // L'ordre général est rétabli : les mieux notés d'abord, shegu au bout.
    expect(candidates.map((c) => c.provider)).toEqual([
      'opensubtitles',
      'opensubtitles',
      'opensubtitles',
      'opensubtitles',
      'shegu',
      'shegu',
    ]);
  });

  it('ne réserve rien à une source qui n’a rien renvoyé', async () => {
    const fromOpenSubtitles = Array.from({ length: 8 }, (_, index) =>
      candidate({ id: `os${index}`, url: `https://x/os${index}`, downloadCount: 900 - index })
    );

    const { candidates } = await searchSubtitles(movie, [
      provider('opensubtitles', fromOpenSubtitles),
      provider('shegu', []),
    ]);

    expect(candidates).toHaveLength(6);
    expect(candidates.every((c) => c.provider === 'opensubtitles')).toBe(true);
  });

  it('garde les résultats d’une source quand l’autre tombe, et le signale', async () => {
    const { candidates, failedProviders } = await searchSubtitles(movie, [
      provider('opensubtitles', new Error('502')),
      provider('shegu', [candidate({ id: 'c', provider: 'shegu' })]),
    ]);

    expect(candidates.map((r) => r.id)).toEqual(['c']);
    expect(failedProviders).toEqual(['opensubtitles']);
  });

  it('ne signale une panne que si toutes les sources tombent', async () => {
    await expect(
      searchSubtitles(movie, [
        provider('opensubtitles', new Error('502')),
        provider('shegu', new Error('timeout')),
      ])
    ).rejects.toMatchObject({ code: 'upstream' });
  });

  it('distingue « aucun sous-titre » d’une panne', async () => {
    await expect(
      searchSubtitles(movie, [provider('opensubtitles', []), provider('shegu', [])])
    ).resolves.toEqual({ candidates: [], failedProviders: [] });
  });

  it('dédoublonne sur l’URL et plafonne la liste', async () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      candidate({ id: `n${index}`, url: `https://x/${index}`, downloadCount: 100 - index })
    );
    const { candidates } = await searchSubtitles(movie, [
      provider('opensubtitles', many),
      provider('shegu', [candidate({ id: 'dup', url: 'https://x/0', provider: 'shegu' })]),
    ]);

    expect(candidates).toHaveLength(6);
    expect(candidates.filter((r) => r.url === 'https://x/0')).toHaveLength(1);
  });
});

describe('decompressIfGzipped', () => {
  it('décompresse ce qui vient d’OpenSubtitles', () => {
    const original = '1\n00:00:01,000 --> 00:00:02,000\nHello';
    const gzipped = gzipSync(Buffer.from(original, 'utf8'));
    const buffer = gzipped.buffer.slice(
      gzipped.byteOffset,
      gzipped.byteOffset + gzipped.byteLength
    ) as ArrayBuffer;

    expect(new TextDecoder().decode(decompressIfGzipped(buffer))).toBe(original);
  });

  it('laisse passer le texte brut de shegu', () => {
    const plain = new TextEncoder().encode('1\n00:00:01,000 --> 00:00:02,000\nHello');
    const buffer = plain.buffer as ArrayBuffer;
    // Rendu tel quel, sans copie ni tentative de décompression.
    expect(decompressIfGzipped(buffer)).toBe(buffer);
  });

  it('n’explose pas sur un corps vide', () => {
    expect(decompressIfGzipped(new ArrayBuffer(0)).byteLength).toBe(0);
  });
});
