# cuecard

Apprendre l'anglais avec les sous-titres des films et séries regardés en
streaming, depuis son téléphone, en second écran.

Le timing des sous-titres d'OpenSubtitles ne correspond jamais à celui du
lecteur Netflix ou Prime : l'entrée principale de l'app est donc la **recherche
textuelle** d'une réplique, pas le timestamp.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · next-intl (FR / EN) ·
Fuse.js · Zustand + IndexedDB.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir <http://localhost:3000> et charger un fichier `.srt` ou `.vtt`.

Copier `.env.example` vers `.env.local` quand les étapes qui appellent des API
externes seront en place — l'étape 1 n'a besoin d'aucune clé.

## Scripts

| Commande            | Effet                    |
| ------------------- | ------------------------ |
| `npm run dev`       | Serveur de développement |
| `npm run build`     | Build de production      |
| `npm test`          | Tests unitaires (Vitest) |
| `npm run typecheck` | Vérification TypeScript  |
| `npm run lint`      | ESLint                   |
| `npm run format`    | Prettier                 |

## Avancement

- [x] **Étape 1** — parsing SRT/VTT, lecteur de répliques, recherche floue,
      à partir d'un fichier chargé à la main.
- [x] **Étape 2** — tap sur un mot, sélection d'expression, dictionnaire dans
      une bottom sheet.
- [ ] Étape 3 — TMDB + OpenSubtitles, calibrage et mémorisation de l'offset.
- [ ] Étape 4 — sens en contexte via OpenRouter.
- [ ] Étape 5 — carnet de vocabulaire, export Anki, PWA hors ligne.

## Ce que fait l'étape 2

**Sélection** (`src/components/CueText.tsx`) — un tap sur un mot ouvre sa
définition ; un appui long suivi d'un glissement sélectionne une expression
entière, y compris à cheval sur deux lignes. Pendant la sélection, le lecteur
cesse d'interpréter le glissement comme un changement de réplique.

**Panneau** (`src/components/BottomSheet.tsx`) — feuille glissante en bas sur
mobile, fermable au balayage vers le bas, à la croix, au fond ou à Échap ;
panneau latéral sur desktop. Toujours monté, donc les deux sens s'animent.

**Dictionnaire** (`/api/dictionary/[word]`) — appel serveur vers
dictionaryapi.dev, validé par zod et normalisé : phonétique, bouton audio,
définitions regroupées par nature grammaticale, exemples, synonymes. Les
formes fléchies sont rattrapées côté serveur (`running` → `run`,
`chances` → `chance`, `wolves` → `wolf`) et la feuille dit quelle forme a
répondu. Résultats mis en cache côté serveur et côté client.

**Liens externes** — WordReference, Youglish, Wiktionary. De simples liens,
aucun scraping.

Chaque cas d'échec a son message et sa porte de sortie : mot introuvable,
dictionnaire injoignable (avec bouton « réessayer »), expression sans entrée
de dictionnaire — et les liens externes restent toujours affichés.

## Ce que fait l'étape 1

**Parsing** (`src/lib/subtitles/`) — SRT et VTT, détection d'encodage
(UTF-8 / windows-1252, BOM), nettoyage des balises `<i>`, `<font>`, `{\an8}`,
`{\pos(...)}`, des marqueurs VTT et des entités HTML, fusion des répliques
simultanées, réparation des timings incohérents.

**Recherche** (`src/lib/subtitles/search.ts`) — correspondances littérales
d'abord, puis approximatif via Fuse.js. Insensible à la casse, aux accents,
à la ponctuation et aux apostrophes ; tolérante aux fautes de frappe. Chaque
résultat affiche son timestamp, pour choisir la bonne occurrence.

**Lecteur** (`src/components/CuePlayer.tsx`) — la réplique courante en grand,
trois avant et trois après en plus petit et cliquables. Navigation au balayage
horizontal, aux deux gros boutons, ou aux flèches du clavier. Chaque mot est
déjà une cible d'au moins 44px, prête à recevoir le tap de l'étape 2.

La session (fichier + position) est conservée dans IndexedDB : recharger la
page ou perdre le wifi ne la perd pas.
