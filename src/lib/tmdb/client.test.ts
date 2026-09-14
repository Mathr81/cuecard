import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getShow, searchMulti } from './client';
import { tmdbLanguage } from './language';

let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('tmdbLanguage', () => {
  it('sends a full locale tag, never a bare language', () => {
    expect(tmdbLanguage('fr')).toBe('fr-FR');
    expect(tmdbLanguage('en')).toBe('en-US');
    expect(tmdbLanguage(null)).toBe('fr-FR');
  });
});

describe('searchMulti', () => {
  beforeEach(() => vi.stubEnv('TMDB_API_KEY', 'v3key'));

  it('passes a v3 key in the query string', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
    await searchMulti('matrix', 'fr-FR');

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('api_key')).toBe('v3key');
    expect(url.searchParams.get('query')).toBe('matrix');
    expect(url.searchParams.get('language')).toBe('fr-FR');
  });

  it('passes a v4 read token as a bearer header instead', async () => {
    vi.stubEnv('TMDB_API_KEY', 'eyJhbGciOiJIUzI1NiJ9.token');
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
    await searchMulti('matrix', 'fr-FR');

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.has('api_key')).toBe(false);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^Bearer eyJ/);
  });

  it('keeps only films and series, with their year', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          { id: 1, media_type: 'person', name: 'Keanu Reeves' },
          { id: 603, media_type: 'movie', title: 'The Matrix', release_date: '1999-03-30' },
          { id: 1396, media_type: 'tv', name: 'Breaking Bad', first_air_date: '2008-01-20' },
          { id: 2, media_type: 'movie', title: '' },
        ],
      })
    );

    const results = await searchMulti('x', 'fr-FR');
    expect(results).toEqual([
      expect.objectContaining({ mediaType: 'movie', tmdbId: 603, name: 'The Matrix', year: 1999 }),
      expect.objectContaining({ mediaType: 'tv', tmdbId: 1396, year: 2008 }),
    ]);
  });

  it('reports a missing key before calling anything', async () => {
    vi.stubEnv('TMDB_API_KEY', '');
    await expect(searchMulti('x', 'fr-FR')).rejects.toMatchObject({ code: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getShow', () => {
  beforeEach(() => vi.stubEnv('TMDB_API_KEY', 'v3key'));

  it('drops the specials season and the empty ones', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 1396,
        name: 'Breaking Bad',
        first_air_date: '2008-01-20',
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 3 },
          { season_number: 1, name: 'Season 1', episode_count: 7, air_date: '2008-01-20' },
          { season_number: 2, name: 'Season 2', episode_count: 0 },
        ],
      })
    );

    const show = await getShow(1396, 'fr-FR');
    expect(show.seasons).toEqual([
      { seasonNumber: 1, name: 'Season 1', episodeCount: 7, airYear: 2008 },
    ]);
  });
});
