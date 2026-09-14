# syntax=docker/dockerfile:1

# better-sqlite3 v13 livre ses binaires précompilés dans son paquet npm (glibc
# et musl, x64 et arm64). Mais il livre aussi un binding.gyp, et npm en déduit
# qu'il faut compiler : sur arm64/musl il lance node-gyp, qui échoue faute de
# Python et de compilateur. Couper les scripts d'installation évite cette
# compilation inutile — le binaire déjà présent est chargé au require — et
# aucune dépendance de ce projet n'a besoin d'un script d'installation.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Si aucun binaire ne convenait à cette plateforme, autant l'apprendre ici
# plutôt que de voir le conteneur boucler au démarrage.
RUN node -e "require('better-sqlite3')(':memory:').exec('CREATE TABLE probe(x)')"


FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CUECARD_DB_PATH=/data/cuecard.db

# su-exec sert à abandonner les droits root dans l'entrypoint, une fois le
# volume de données rendu inscriptible.
RUN apk add --no-cache su-exec

# `output: 'standalone'` ne copie que le serveur et les dépendances réellement
# atteintes ; les fichiers statiques et publics se posent à côté à la main.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# wget est fourni par busybox : rien à installer pour la sonde. Elle touche la
# base, parce qu'un serveur qui répond avec un volume mal monté n'est pas sain.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
