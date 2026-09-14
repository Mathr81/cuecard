/** "1:23:45" pour un film, "12:34" pour un épisode : on n'affiche l'heure que si elle existe. */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Au-delà, « +4968s » ne veut plus rien dire : une durée se lit mieux. */
const OFFSET_SECONDS_LIMIT = 120;

/** Décalage signé, tel qu'affiché discrètement dans le lecteur : "+12s", "-3s". */
export function formatOffset(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const sign = seconds >= 0 ? '+' : '-';
  const absolute = Math.abs(seconds);
  return absolute < OFFSET_SECONDS_LIMIT
    ? `${sign}${absolute}s`
    : `${sign}${formatTimestamp(absolute * 1000)}`;
}

const HOUR_MINUTE = /^(\d{1,3})\s*h\s*(\d{1,2})?\s*(?:m(?:in)?)?\s*(\d{1,2})?\s*s?$/i;
const MINUTE_SECOND = /^(\d{1,4})\s*m(?:in)?\s*(\d{1,2})?\s*s?$/i;
const SECONDS_ONLY = /^(\d{1,6})\s*s?$/i;

/**
 * Je relève l'heure sur mon lecteur à l'arrache : "1:23:45", "83:45", "1h23",
 * ou juste un nombre de secondes. Tout doit passer, sinon je retape trois fois.
 */
export function parseTimeInput(input: string): number | null {
  const value = input.trim().replace(',', ':');
  if (value.length === 0) return null;

  if (value.includes(':')) {
    const parts = value.split(':').map((part) => part.trim());
    if (parts.some((part) => !/^\d{1,6}$/.test(part))) return null;

    const numbers = parts.map(Number);
    if (numbers.length === 2) {
      // "83:45" : les minutes peuvent dépasser 60, c'est même le cas courant.
      const [minutes, seconds] = numbers;
      return seconds < 60 ? (minutes * 60 + seconds) * 1000 : null;
    }
    if (numbers.length === 3) {
      const [hours, minutes, seconds] = numbers;
      return minutes < 60 && seconds < 60 ? (hours * 3600 + minutes * 60 + seconds) * 1000 : null;
    }
    return null;
  }

  const hourMinute = HOUR_MINUTE.exec(value);
  if (hourMinute) {
    const [, hours, minutes, seconds] = hourMinute;
    return (Number(hours) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0)) * 1000;
  }

  const minuteSecond = MINUTE_SECOND.exec(value);
  if (minuteSecond) {
    const [, minutes, seconds] = minuteSecond;
    return (Number(minutes) * 60 + Number(seconds ?? 0)) * 1000;
  }

  const secondsOnly = SECONDS_ONLY.exec(value);
  if (secondsOnly) return Number(secondsOnly[1]) * 1000;

  return null;
}
