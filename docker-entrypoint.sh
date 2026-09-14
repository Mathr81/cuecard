#!/bin/sh
set -e

# Le dossier de données est monté depuis l'hôte et lui appartient — souvent à
# root, alors que le serveur tourne en « node ». On lui rend la main sur ce
# seul dossier, puis on abandonne les droits root avant de démarrer.
if [ "$(id -u)" = '0' ]; then
  data_dir="$(dirname "${CUECARD_DB_PATH:-/data/cuecard.db}")"
  mkdir -p "$data_dir"
  chown node:node "$data_dir"
  exec su-exec node "$@"
fi

# Un `user:` explicite dans le compose reprend la main : on ne touche à rien.
exec "$@"
