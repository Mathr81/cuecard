/**
 * Une variable d'environnement vide n'est pas une variable absente.
 * `docker compose` transmet `FOO=` tel quel, et `process.env.FOO ?? défaut`
 * garde alors la chaîne vide : c'est ainsi que `DICTIONARY_API_URL=`, présent
 * et vide dans le .env d'exemple, transformait l'URL du dictionnaire en
 * « /let » et faisait échouer tous les appels.
 */
export function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function envOr(name: string, fallback: string): string {
  return optionalEnv(name) ?? fallback;
}
