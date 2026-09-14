import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ExternalError } from '@/components/ExternalError';
import { SubtitlePicker } from '@/components/SubtitlePicker';
import { TitlePoster } from '@/components/TitlePoster';
import { ExternalApiError } from '@/lib/external/errors';
import { getMovie, getSeasonEpisodes, getShow } from '@/lib/tmdb/client';
import { tmdbLanguage } from '@/lib/tmdb/language';
import type { ApiErrorCode } from '@/lib/api/client';
import type { MediaType, TitleRef } from '@/lib/titles/types';

interface Props {
  params: Promise<{ mediaType: string; tmdbId: string }>;
  searchParams: Promise<{ season?: string; episode?: string }>;
}

function parseNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return value !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export default async function TitlePage({ params, searchParams }: Props) {
  const { mediaType, tmdbId: rawId } = await params;
  const { season: rawSeason, episode: rawEpisode } = await searchParams;

  const tmdbId = Number(rawId);
  if ((mediaType !== 'movie' && mediaType !== 'tv') || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    notFound();
  }

  const locale = await getLocale();
  const language = tmdbLanguage(locale);
  const t = await getTranslations('titles');

  try {
    return mediaType === 'movie'
      ? await renderMovie(tmdbId, language)
      : await renderShow(tmdbId, language, parseNumber(rawSeason), parseNumber(rawEpisode));
  } catch (cause) {
    const code: ApiErrorCode =
      cause instanceof ExternalApiError ? (cause.code as ApiErrorCode) : 'upstream';
    return (
      <Shell title={t('unavailable')} backHref="/">
        <ExternalError code={code} service="TMDB" />
      </Shell>
    );
  }
}

async function renderMovie(tmdbId: number, language: string) {
  const movie = await getMovie(tmdbId, language);
  const title: TitleRef = {
    mediaType: 'movie',
    tmdbId: movie.tmdbId,
    name: movie.name,
    year: movie.year,
    posterPath: movie.posterPath,
    season: null,
    episode: null,
    episodeName: null,
    genres: movie.genres,
  };

  const t = await getTranslations('subtitles');
  return (
    <Shell
      title={movie.name}
      subtitle={movie.year ? String(movie.year) : null}
      backHref="/"
      poster={movie.posterPath}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">{t('choose')}</h2>
      <SubtitlePicker title={title} />
    </Shell>
  );
}

async function renderShow(
  tmdbId: number,
  language: string,
  season: number | null,
  episode: number | null
) {
  const show = await getShow(tmdbId, language);
  const t = await getTranslations('titles');
  const tSubtitles = await getTranslations('subtitles');

  if (season === null) {
    return (
      <Shell title={show.name} subtitle={t('pickSeason')} backHref="/" poster={show.posterPath}>
        <ul className="flex flex-col gap-2">
          {show.seasons.map((item) => (
            <li key={item.seasonNumber}>
              <Link
                href={`/title/tv/${tmdbId}?season=${item.seasonNumber}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 active:bg-surface-high"
              >
                <span className="truncate text-base font-medium text-ink">{item.name}</span>
                <span className="shrink-0 text-sm text-dim">
                  {t('episodeCount', { count: item.episodeCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  const episodes = await getSeasonEpisodes(tmdbId, season, language);

  if (episode === null) {
    return (
      <Shell
        title={show.name}
        subtitle={t('pickEpisode', { season })}
        backHref={`/title/tv/${tmdbId}`}
        poster={show.posterPath}
      >
        <ul className="flex flex-col gap-2">
          {episodes.map((item) => (
            <li key={item.episodeNumber}>
              <Link
                href={`/title/tv/${tmdbId}?season=${season}&episode=${item.episodeNumber}`}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-4 active:bg-surface-high"
              >
                <span className="w-8 shrink-0 font-mono text-sm text-accent">
                  {item.episodeNumber}
                </span>
                <span className="truncate text-base text-ink">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  const chosen = episodes.find((item) => item.episodeNumber === episode);
  const title: TitleRef = {
    mediaType: 'tv' as MediaType,
    tmdbId,
    name: show.name,
    year: show.year,
    posterPath: show.posterPath,
    season,
    episode,
    episodeName: chosen?.name ?? null,
    genres: show.genres,
  };

  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    <Shell
      title={show.name}
      subtitle={[`S${pad(season)}E${pad(episode)}`, chosen?.name].filter(Boolean).join(' · ')}
      backHref={`/title/tv/${tmdbId}?season=${season}`}
      poster={show.posterPath}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">
        {tSubtitles('choose')}
      </h2>
      <SubtitlePicker title={title} />
    </Shell>
  );
}

async function Shell({
  title,
  subtitle,
  backHref,
  poster,
  children,
}: {
  title: string;
  subtitle?: string | null;
  backHref: string;
  poster?: string | null;
  children: React.ReactNode;
}) {
  const t = await getTranslations('common');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4">
      <header className="pt-safe flex items-center gap-2 py-3">
        <Link
          href={backHref}
          aria-label={t('back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-muted"
        >
          ←
        </Link>
        {poster !== undefined ? <TitlePoster path={poster} alt={title} /> : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
      </header>

      <main className="pb-safe flex flex-1 flex-col gap-3 py-2">{children}</main>
    </div>
  );
}
