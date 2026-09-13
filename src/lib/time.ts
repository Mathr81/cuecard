/** "1:23:45" pour un film, "12:34" pour un épisode : on n'affiche l'heure que si elle existe. */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Décalage signé, tel qu'affiché discrètement dans le lecteur : "+12s", "-3s". */
export function formatOffset(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${seconds >= 0 ? '+' : '-'}${Math.abs(seconds)}s`;
}
