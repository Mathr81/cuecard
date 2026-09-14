# cuecard

Apprendre l'anglais avec les sous-titres des films et séries regardés en
streaming, depuis son téléphone, en second écran.

Le timing des sous-titres téléchargés ne correspond jamais à celui du
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

Copier `.env.example` vers `.env.local` et renseigner `TMDB_API_KEY` pour la
recherche de titres, `OPENROUTER_API_KEY` pour le sens en contexte. **Les
sous-titres ne demandent aucune clé** : ils viennent de sources ouvertes, sans
quota journalier. Sans clés du tout, le chargement manuel d'un `.srt` et le
dictionnaire fonctionnent toujours, et chaque écran dit ce qui manque.

`OPENROUTER_MODEL` choisit le modèle ; la valeur par défaut est un point de
départ rapide et bon marché, à changer selon ce qui est disponible. Le modèle
en cours est affiché dans les réglages.

## Déployer avec Docker

L'app est prévue pour vivre derrière **Nginx Proxy Manager** : elle ne publie
aucun port, NPM la joint par son nom sur le réseau Docker partagé.

```bash
cp .env.example .env
docker network ls          # relever le nom du réseau de la stack NPM
$EDITOR .env               # renseigner les clés et CUECARD_NETWORK
docker compose up -d --build
docker compose ps          # doit afficher « healthy »
```

`.env` sert deux fois : Docker Compose y lit `CUECARD_NETWORK` pour résoudre
le `${...}` du `docker-compose.yml`, puis y reprend les clés d'API pour les
injecter dans le conteneur. Le fichier n'entre jamais dans l'image — il est
listé dans `.dockerignore` — donc aucune clé ne se retrouve dans une couche.

Puis dans NPM, un Proxy Host :

| Champ            | Valeur    |
| ---------------- | --------- |
| Forward Hostname | `cuecard` |
| Forward Port     | `3000`    |
| Websockets       | activé    |
| SSL              | activé    |

Si `docker compose up` se plaint que le réseau n'existe pas, c'est que le nom
dans `.env` ne correspond pas à celui de ta stack NPM.

### HTTPS et PWA

Le service worker et l'installation de la PWA **exigent HTTPS**. En HTTP, l'app
reste utilisable mais ne s'installe pas et ne marche pas hors ligne : pense à
demander un certificat à NPM pour cet hôte.

cuecard n'a **aucune authentification**. Sur un domaine public, n'importe qui
peut brûler ton quota OpenRouter — la liste d'accès de NPM
(Access Lists → Basic Auth) se charge de fermer la porte.

### Au quotidien

```bash
docker compose logs -f app        # les journaux
docker compose up -d --build      # mettre à jour après un git pull
docker compose down               # arrêter (les données restent dans ./data)
```

Pour accéder à l'app sans passer par NPM (essai local, débogage), décommente
le bloc `ports` du `docker-compose.yml`.

L'image est construite en trois étapes et ne contient que la sortie
`standalone` de Next : pas de `node_modules` complet, pas de chaîne de
compilation. `better-sqlite3` embarque ses binaires précompilés pour glibc et
musl, x64 et arm64, donc rien ne se compile à l'install et un VPS ARM marche
aussi bien qu'un x86.

Sauvegarde : tout l'état tient dans `./data/cuecard.db` — historique, cache
des sous-titres, décalages calés, explications déjà payées et carnet de
vocabulaire. Copier ce fichier suffit.

Le conteneur tourne sans les droits root : l'entrypoint rend `./data`
inscriptible puis abandonne root, donc il n'y a rien à préparer sur l'hôte
avant le premier démarrage. La sonde de santé (`/api/health`) touche vraiment
la base, parce qu'un serveur qui répond avec un volume mal monté n'est pas en
bonne santé.

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
- [x] **Étape 3** — TMDB + sources de sous-titres, calibrage et mémorisation
      du décalage.
- [x] **Étape 4** — sens en contexte via OpenRouter.
- [x] **Étape 5** — carnet de vocabulaire, export Anki, révision, PWA hors ligne.

## Ce que fait l'étape 5

**Carnet** — un bouton « Sauvegarder » en haut de la feuille de définition
range le mot avec sa réplique complète, le titre, l'épisode, le timestamp, sa
traduction contextuelle et son explication. Sauvegarder avant que le modèle
n'ait répondu marche aussi : l'entrée se complète toute seule quand
l'explication arrive. Le même mot depuis la même réplique n'est jamais
dupliqué, et le resauvegarder n'efface pas l'historique de révision.

**Page `/vocabulaire`** — recherche sur le mot, la réplique et la traduction,
filtre par titre, groupement par titre.

**Export Anki** — CSV à deux colonnes, recto et verso, sans en-tête. Le recto
est la phrase du film avec le mot en gras — l'expression entière d'un bloc,
pas trois mots gras séparés. Le verso porte la traduction contextuelle,
l'explication, le registre, le type et la provenance. Échappement RFC 4180.

**Révision** — une carte, la phrase du film comme contexte, révéler, marquer
su ou pas su. L'ordre est fixé au démarrage : d'abord ce qu'on rate le plus,
puis ce qu'on n'a pas revu depuis le plus longtemps. Pas de SM-2.

**PWA** — manifeste, icônes (dont maskable), mode standalone, thème sombre.
Le service worker met en cache la coquille de l'app et les mots de dictionnaire
déjà consultés ; les répliques sont déjà dans IndexedDB. Résultat : perdre le
wifi au milieu d'un film ne fait pas perdre la session.

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

**Sous-titres** — deux sources ouvertes, interrogées en parallèle, sans clé ni
quota journalier :

- **OpenSubtitles** par son API historique (`rest.opensubtitles.org`), qui
  donne les noms de release et les compteurs de téléchargement. Elle plafonne
  à cent résultats toutes langues confondues, si bien que l'anglais peut
  n'y figurer nulle part — le filtre `sublanguageid-eng` déplace la sélection
  côté serveur et règle le problème. Ses fichiers arrivent gzippés.
- **shegu**, qui cherche directement par identifiant TMDB, sans passer par
  l'IMDb, et répond sur des titres où l'autre ne trouve rien.

L'échec de l'une n'efface jamais les résultats de l'autre ; il faut que les
deux tombent pour parler de panne. Les candidats sont dédoublonnés, classés
par nombre de téléchargements — ceux qui n'en ont pas passent derrière — et
les six premiers sont proposés avec leur source. Chaque fichier téléchargé est
mis en cache en base : on ne redemande jamais deux fois la même chose à des
services qu'on ne paie pas.

Les fichiers d'OpenSubtitles s'ouvrent et se referment souvent sur une réclame
(« Support us and become VIP member », `osdb.link`). Le parseur l'écarte :
sinon la première réplique du lecteur serait une publicité, et elle
remonterait dans les recherches.

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
