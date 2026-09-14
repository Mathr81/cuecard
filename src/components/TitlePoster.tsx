import Image from 'next/image';

const POSTER_WIDTH = 60;
const POSTER_HEIGHT = 90;

/** Affiche TMDB, ou un carré sombre quand il n'y en a pas : la liste doit
 *  garder le même rythme visuel dans les deux cas. */
export function TitlePoster({ path, alt }: { path: string | null; alt: string }) {
  if (!path) {
    return (
      <div
        aria-hidden
        className="shrink-0 rounded-lg bg-surface-high"
        style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}
      />
    );
  }

  return (
    <Image
      src={`https://image.tmdb.org/t/p/w154${path}`}
      alt={alt}
      width={POSTER_WIDTH}
      height={POSTER_HEIGHT}
      className="shrink-0 rounded-lg object-cover"
      unoptimized
    />
  );
}
