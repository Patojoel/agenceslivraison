# CLAUDE.md

Référence du projet **agenceslivraison** pour Claude Code : marketplace logistique multi-tenant au Cameroun (agences de livraison, de stockage ou hybrides ; clients particuliers et commerçants). Monorepo : `backend/` (API NestJS, seule partie développée), `frontend/` (`front-office`, `admin-back-office-agence`, `admin-platform`, vides pour l'instant), `mobile/` (livreurs et commerçants, à venir).

**Documentation chargée à la demande :**
- `docs/cahier-des-charges/` : cahier des charges (lecture seule). Commencer par `README.md` et `CODEX.md`, puis `docs/architecture/`, `docs/delivery/roadmap.md`, `docs/delivery/acceptance.md` et la fiche `docs/modules/NN-*.md` du lot.
- `backend/docs/domains.md` : modules, agrégats, invariants et cas d'usage déjà implémentés.
- `backend/docs/events.md` : événements de domaine et leurs subscribers.
- `backend/docs/routes/*.md` et `backend/docs/conventions.md` : contrat HTTP pour les clients web et mobiles.
- `backend/docs/operations/exploitation.md` : production, secrets, sauvegardes.

**Config Claude Code (`.claude/`) :**
- Skills à charger avant d'écrire du code : `plan-avant-implementation`, `core-ddd`, `core-hexagonal`, `core-tdd`, `core-sql-query`, `core-security`, `core-clean-code`, `core-refactoring`, `core-use-cases`, `revue-et-correction` (et `core-front-stack` quand le front démarrera). Ce fichier prime sur eux.
- Agents :

  | Agent | Rôle | Modifie le code |
  |---|---|---|
  | `use-case-writer` | Transforme une fiche module en use cases BDD, Gherkin et plan TDD | non (docs) |
  | `back-builder` | Implémente un cas d'usage NestJS de bout en bout, en TDD | oui |
  | `query-perf` | Lectures lourdes, pagination, index, EXPLAIN, concurrence (stock) | oui |
  | `infra-devops` | Docker, Compose, CI, migrations au déploiement, sauvegardes | oui |
  | `archi-reviewer` | Relecture architecture et modèle | non |
  | `security-reviewer` | Relecture sécurité (isolation entre agences, auth, IDOR…) | non |

  Enchaînement type d'un lot : `use-case-writer` → plan validé par le user → `back-builder` (+ `query-perf` / `infra-devops`) → `archi-reviewer` + `security-reviewer` selon le mode.

---

## Mode de travail — à demander au user en début de session

**Avant toute tâche, la session principale demande au user le mode de la session.** Il vaut pour toute la session et est rappelé dans chaque consigne donnée à un agent.

| Mode | Revues | Tests | Code |
|---|---|---|---|
| **full** (strict) | `archi-reviewer` systématique sur le back ; `security-reviewer` dès que le périmètre critique est touché. | Tests des modules touchés pendant le travail, puis suite complète (`lint`, `typecheck`, `build`, `test`, `test:e2e`) avant le commit final. | Standard |
| **light** | Sécurité seulement, sur le périmètre critique. Pas d'`archi-reviewer`. | Tests du code écrit (`node --import tsx --test test/<module>/*.test.ts`) ; la suite complète ne tourne qu'une fois, avant le commit final. | Concis, priorité à l'avancement |

**Périmètre critique** (`security-reviewer` obligatoire dans les deux modes) : authentification, sessions et jetons ; mots de passe et invitations ; rôles, memberships et autorisations ; isolation entre agences (`agencyId`) et tout identifiant de chemin ; routes publiques (`/public/...`, marketplace) ; transferts inter-agences ; uploads et preuves de livraison ; secrets et configuration de production ; données personnelles (clients finaux, livreurs).

**Inchangé dans tous les modes :** plan validé avant le code (skill `plan-avant-implementation`) ; TDD avec le test rouge d'abord ; règles non négociables ci-dessous ; tests des modules touchés verts avant commit ; ne jamais annoncer un vert non obtenu ; un lot terminé avant le suivant (`roadmap.md`).

---

## Fiche projet

| Clé | Valeur |
|---|---|
| Stack | NestJS 11, TypeScript strict, Node 22, PostgreSQL 16 ; référence `core-hexagonal/references/nestjs.md` **sauf** les écarts listés ici |
| Clé de tenant | `agencyId` (colonne `agency_id`). Résolue côté serveur depuis le membership actif de l'utilisateur ; jamais lue dans un corps HTTP. Ressource d'une autre agence → **404**. |
| Identités | `userId`, `agencyId`, `merchantId` sont distincts ; un utilisateur peut avoir plusieurs memberships. |
| Authentification | Jeton d'accès JWT court + session à refresh rotatif haché (`OpaqueToken`, condensat SHA-256), Argon2id ; `AccessTokenGuard` et `@CurrentUser()` exposés par `identity`. Jamais de JWT en `localStorage`. |
| Sensibilité | Données personnelles de clients finaux et livreurs, preuves de livraison, géolocalisation. Pas de paiement géré (paiement direct à l'agence). |
| Langue | Code et identifiants en anglais ; documentation, messages de commit et échanges en français. |
| Persistance | Schéma Drizzle centralisé dans `backend/src/schema/` → `npm run db:generate` → `backend/migrations/` (forward-only, jamais modifier une migration appliquée). Repositories `Pg<Agg>Repository` en SQL paramétré via `Database` (`pg`, transaction propagée par `AsyncLocalStorage`). Lectures via le port `SqlReader`. |
| Cas d'usage | `application/command/<cas>/` : `.command.ts`, `.handler.ts`, `.response.ts`. Handlers **sans décorateur NestJS**, câblés par `useFactory` dans `<module>.module.ts`, appelés via `TransactionalCommandHandlerFactory`. Queries dans `application/queries/<cas>/`. |
| Erreurs | `DomainException` avec catégorie (`invalid`, `unauthorized`, `forbidden`, `not_found`, `conflict`) → `ProblemDetailsFilter` (RFC 9457, `application/problem+json`). |
| Événements | `DomainEventPublisher` in-process, subscribers dans `application/subscribers/` (audit). Pas d'outbox ni de broker tant qu'un besoin inter-domaines n'est pas validé. |
| HTTP | Préfixe `/api/v1`, validation Zod `.strict()` (`parse-request.ts`), OpenAPI `@nestjs/swagger` (`/api/v1/docs`), listes `{ items, nextCursor, hasMore }`, `Idempotency-Key` sur acceptation de demande, création de commande et transferts. |
| Tests | `node:test` + `tsx` (pas de Jest/Vitest). Unitaires : `backend/test/<module>/*.test.ts`, doublures in-memory dans `test/<module>/fakes.ts` et `test/support/fakes.ts`, aucune bibliothèque de mock. PostgreSQL réel + HTTP : `test/e2e.cjs` sur base **dédiée et vide**. |
| Base locale de test | `docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from test-api` (base tmpfs détruite à l'arrêt), ou `TEST_DATABASE_URL=... npm run test:e2e`. Jamais une base contenant des données. |
| Cahier des charges | `docs/cahier-des-charges/` |

## Commandes (depuis `backend/`)

```sh
npm ci
npm run lint          # eslint --max-warnings=0
npm run typecheck     # src + tests
npm run build
npm test              # tous les tests unitaires
node --import tsx --test "test/agencies/*.test.ts"   # un module
npm run db:generate   # migration depuis src/schema
docker compose up --build -d && docker compose exec api npm run migrate
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from test-api
docker compose -f compose.test.yaml down
```

## Règles non négociables

- Domaine pur : `domain/` n'importe ni NestJS, ni `pg`, ni Drizzle, ni Zod, ni Node.
- Inter-modules : par événement ou par ce qu'un module expose explicitement (ex. `AccessTokenGuard` d'`identity`). Jamais les tables, repositories ou handlers d'un autre module.
- Un handler écrit un agrégat principal par transaction ; les invariants critiques (stock jamais négatif, acceptation unique d'une demande) sont tenus par contraintes SQL, version optimiste ou verrou, avec test de concurrence.
- Transition de statut = méthode gardée de l'agrégat + endpoint d'action ; jamais un `PATCH { status }`. Aucune suppression physique d'un agrégat historisé (commande, colis, stock, suivi).
- Une demande marketplace n'est pas une commande ; une tentative de livraison échouée ne clôture pas la commande.
- **Hors périmètre MVP** : paiements, commissions, notifications, messagerie, WhatsApp, abonnements facturés, Redis, BullMQ, RabbitMQ, websockets, microservices. Ne rien ajouter « en prévision ».
- Règle marquée **À VALIDER** dans le cahier des charges : ne pas la coder comme vérité, poser la question.
- Chaque nouvelle route ou modification de contrat met à jour `backend/docs/routes/`, `backend/docs/domains.md` / `events.md` et l'OpenAPI.
- Aucun `any`, aucun secret dans le dépôt ou les logs.

## Format de fin de lot

Fichiers modifiés ; règles implémentées ; endpoints ; migrations ; commandes réellement exécutées et leur résultat ; risques ; décisions ouvertes ; proposition du lot suivant.
