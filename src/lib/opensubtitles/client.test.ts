import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestDownload, searchSubtitles } from './client';
import { ExternalApiError } from '@/lib/external/errors';
import type { TitleRef } from '@/lib/titles/types';

const episode: TitleRef = {
  mediaType: 'tv',
  tmdbId: 1396,
  name: 'Breaking Bad',
  year: 2008,
  posterPath: null,
  season: 1,
  episode: 4,
  episodeName: 'Cancer Man',
  genres: ['Crime'],
};

const movie: TitleRef = {
  ...episode,
  mediaType: 'movie',
  tmdbId: 603,
  season: null,
  episode: null,
};

function subtitle(fileId: number, downloads: number, release: string) {
  return {
    attributes: {
      release,
      download_count: downloads,
      from_trusted: true,
      hearing_impaired: false,
      upload_date: '2020-01-01',
      files: [{ file_id: fileId, file_name: `${release}.srt` }],
    },
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('OPENSUBTITLES_API_KEY', 'test-key');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('searchSubtitles', () => {
  it('queries an episode by show, season and episode', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await searchSubtitles(episode);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('parent_tmdb_id')).toBe('1396');
    expect(url.searchParams.get('season_number')).toBe('1');
    expect(url.searchParams.get('episode_number')).toBe('4');
    expect(url.searchParams.get('languages')).toBe('en');
  });

  it('queries a movie by its own id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await searchSubtitles(movie);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('tmdb_id')).toBe('603');
    expect(url.searchParams.has('season_number')).toBe(false);
  });

  it('sends the API key and the required User-Agent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await searchSubtitles(movie);

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Api-Key']).toBe('test-key');
    expect(headers['User-Agent']).toMatch(/cuecard/);
  });

  it('keeps the three most downloaded, best first', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          subtitle(1, 50, 'WEB-DL'),
          subtitle(2, 900, 'BluRay'),
          subtitle(3, 300, 'HDTV'),
          subtitle(4, 200, 'DVDRip'),
        ],
      })
    );

    const candidates = await searchSubtitles(movie);
    expect(candidates.map((candidate) => candidate.fileId)).toEqual([2, 3, 4]);
    expect(candidates[0]).toMatchObject({ releaseName: 'BluRay', downloadCount: 900 });
  });

  it('skips entries without a downloadable file', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [{ attributes: { release: 'Broken', files: [] } }, subtitle(9, 1, 'Ok')],
      })
    );
    expect((await searchSubtitles(movie)).map((c) => c.fileId)).toEqual([9]);
  });

  it('reports a missing key instead of calling the API', async () => {
    vi.stubEnv('OPENSUBTITLES_API_KEY', '');
    await expect(searchSubtitles(movie)).rejects.toMatchObject({ code: 'missing_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns an invalid key into an actionable code', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'invalid api key' }, 401));
    await expect(searchSubtitles(movie)).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

describe('requestDownload', () => {
  it('returns the link and the remaining daily quota', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ link: 'https://dl.test/file.srt', remaining: 17, reset_time: '3 hours' })
    );

    await expect(requestDownload(42)).resolves.toEqual({
      link: 'https://dl.test/file.srt',
      remaining: 17,
      resetTime: '3 hours',
    });
  });

  it('treats a link-less success as an exhausted quota', async () => {
    // OpenSubtitles répond 200 avec un simple message quand le quota est épuisé.
    fetchMock.mockResolvedValue(jsonResponse({ message: 'You have downloaded your allowed...' }));
    await expect(requestDownload(42)).rejects.toBeInstanceOf(ExternalApiError);
    await expect(requestDownload(42)).rejects.toMatchObject({ code: 'quota_exhausted' });
  });

  it('maps the explicit quota status too', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'quota' }, 406));
    await expect(requestDownload(42)).rejects.toMatchObject({ code: 'quota_exhausted' });
  });
});
