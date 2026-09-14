import { z } from 'zod';

export const titleRefSchema = z.object({
  mediaType: z.enum(['movie', 'tv']),
  tmdbId: z.number().int().positive(),
  name: z.string().min(1).max(300),
  year: z.number().int().nullable(),
  posterPath: z.string().max(300).nullable(),
  season: z.number().int().nonnegative().nullable(),
  episode: z.number().int().nonnegative().nullable(),
  episodeName: z.string().max(300).nullable(),
  genres: z.array(z.string().max(60)).max(10).default([]),
});
