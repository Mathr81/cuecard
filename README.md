# cuecard

Apprendre l'anglais avec les sous-titres des films et séries regardés en
streaming, depuis son téléphone, en second écran.

Le timing des sous-titres d'OpenSubtitles ne correspond jamais à celui du
lecteur Netflix ou Prime : l'entrée principale de l'app est donc la **recherche
textuelle** d'une réplique, pas le timestamp.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · next-intl (FR / EN) ·
Fuse.js · Zustand + IndexedDB · SQLite (better-sqlite3) · zod · OpenRouter.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir <http://localhost:3000> et charger un fichier `.srt` ou `.vtt`.

Copier `.env.example` vers `.env.local` et renseigner `TMDB_API_KEY` et
`OPENSUBTITLES_API_KEY` pour la recherche de titres et le téléchargement des
sous-titres, `OPENROUTER_API_KEY` pour le sens en contexte. Sans clés, le
chargement manuel d'un `.srt` et le dictionnaire fonctionnent toujours, et
chaque écran dit précisément quelle clé manque.

`OPENROUTER_MODEL` choisit le modèle ; la valeur par défaut est un point de
départ rapide et bon marché, à changer selon ce qui est disponible. Le modèle
en cours est affiché dans les réglages.

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
- [x] **Étape 3** — TMDB + OpenSubtitles, calibrage et mémorisation du décalage.
- [x] **Étape 4** — sens en contexte via OpenRouter.
- [ ] Étape 5 — carnet de vocabulaire, export Anki, PWA hors ligne.

## Ce que fait l'étape 4

**Sens en contexte** (`/api/sense`) — le troisième bloc de la feuille, chargé
en parallèle des deux autres : le dictionnaire s'affiche sans jamais attendre
le modèle. On envoie le mot ou l'expression, la réplique courante repérée par
un marqueur, quatre répliques avant et quatre après, le titre, l'année et les
genres TMDB. La réponse est un JSON strict validé par zod :
traduction contextuelle, explication en deux phrases, registre, type
(idiome, phrasal verb, référence culturelle…), note culturelle si nécessaire,
et des exemples bilingues.

Une réponse presque conforme est rattrapée avant d'être refusée — « informal »
vaut « familier », « litteral » vaut « littéral », une note vide vaut `null` —
parce qu'une relance coûte une seconde d'attente et des jetons. Si elle reste
hors contrat, une seule relance, puis un message clair : boucler indéfiniment
sur un modèle qui ne s'y conforme pas ne sert à rien.

**Cache** — par mot, scène, langue et modèle. Recliquer sur un mot déjà
expliqué ne coûte rien et ne fait rien attendre.

**Langue des explications** — réglage séparé de celui de l'interface, persisté
indépendamment : app en français et explications en anglais pour un mode
immersion totale, ou l'inverse.

**Compteur de jetons** — dans les réglages : total, entrée / sortie, appels
payés, appels servis par le cache, et depuis quand. Remise à zéro d'un bouton.

## Ce que fait l'étape 3

**Recherche de titre** — TMDB `/search/multi` : affiche, année, film ou série.
Pour une série, saison puis épisode. Historique des dix derniers titres
consultés en accès direct sur l'accueil, stocké en base ; celui qui est déjà
chargé est marqué « en cours » et renvoie droit au lecteur, sans reconsommer
de quota.

**Sous-titres** — OpenSubtitles API v1, anglais, triés par nombre de
téléchargements, les trois meilleurs candidats avec leur nom de release, leur
compte de téléchargements et leurs étiquettes. Un épisode est cherché par
série + saison + épisode, bien plus fiable que par l'id TMDB de l'épisode.
User-Agent obligatoire envoyé, appels espacés de 250 ms. Chaque fichier
téléchargé est mis en cache en base par `file_id` : le quota journalier ne
paie jamais deux fois le même fichier.

**Calibrage** — le mode texte reste l'entrée principale ; deux boutons sous le
champ donnent accès au mode temps. « Caler » demande le temps affiché par le
lecteur pour la réplique courante, calcule le décalage et le mémorise pour ce
titre **et** cette source. Toutes les recherches par temps suivantes sont
corrigées. Le décalage actif s'affiche discrètement (« +12s ») avec un bouton
pour le remettre à zéro. Un décalage aberrant est refusé avant d'être envoyé,
et un échec d'enregistrement est dit à l'écran plutôt que tu. Le champ accepte
`1:23:45`, `83:45`, `1h23`, `12min30` ou `5023`.

**Base** — SQLite via better-sqlite3 : historique, cache des fichiers,
décalages. Le fichier vit dans `.data/cuecard.db` (surchargeable par
`CUECARD_DB_PATH`).

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
