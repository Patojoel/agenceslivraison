# Phases du projet — agenceslivraison

Référence détaillée de **tout** ce qu'il reste à construire : backend (B), frontend web (F) et mobile (M).
Ce fichier dit **quoi faire et dans quel ordre**. L'avancement réel se coche dans [progress.md](progress.md), avec les mêmes identifiants (`B2.3`, `F1.4`, `M2.1`…).

- **Sources** : `docs/cahier-des-charges/` (lecture seule), `CLAUDE.md`, `backend/docs/`. En cas de contradiction, le cahier des charges et `CLAUDE.md` priment sur ce fichier.
- **Ne modifier ce fichier que si le plan change** (nouvelle décision, phase redécoupée, règle À VALIDER tranchée). Noter alors la modification dans le journal de `progress.md`.
- **Étiquettes** : **À VALIDER** = décision métier non tranchée, ne jamais la coder comme vérité ; **CRITIQUE** = périmètre critique de `CLAUDE.md`, `security-reviewer` obligatoire quel que soit le mode.
- Les endpoints listés sont **indicatifs** (fiches modules) : le contrat final est fixé dans le plan validé du lot puis documenté dans `backend/docs/routes/`.

---

## 0. Décisions de stack

| Partie | Choix | Statut |
|---|---|---|
| API | NestJS 11, TypeScript strict, Node 22, PostgreSQL 16, monolithe modulaire, hexagonal + DDD + CQRS léger | CONFIRMÉ (`CLAUDE.md`) |
| Persistance | TypeORM 0.3 sur PostgreSQL, migrations TypeORM (`backend/src/migrations/`) ; écart assumé à l'ADR-02 du cahier des charges (`docs/architecture/adr-001-typeorm-et-architecture-normalisee.md`) | décidé le 2026-11-03 (D-01) |
| Architecture des modules | `domain/`, `application/`, `infrastructure/`, `presentation/http/`, `tests/` par module, `kebab-case` + suffixes de rôle, alias `@shared/` `@modules/` `@config/` (`docs/architecture/architecture-backend.md`) | décidé le 2026-11-03 (D-01) |
| Front-office public (`frontend/front-office`) | Next.js App Router (SEO de l'annuaire marketplace) | décidé le 2026-11-03 |
| Back-office agence (`frontend/admin-back-office-agence`) | SPA Vite + Redux Toolkit, architecture hexagonale front | décidé le 2026-11-03 |
| Admin plateforme (`frontend/admin-platform`) | SPA Vite + Redux Toolkit | décidé le 2026-11-03 |
| Commun web | TypeScript strict, Tailwind, shadcn/ui, React Hook Form + Zod, i18n (français d'abord), types générés depuis l'OpenAPI | skill `core-front-stack` |
| Mobile livreur et commerçant (`mobile/`) | React Native + Expo, TypeScript, `expo-secure-store` pour les jetons | décidé le 2026-11-03 |

---

## 1. Ordre global et synchronisation

```text
B0 ─ B1 ─ B2 ─ B3 ─ B4 ─ B5 ─┬─ B6 ─┐
                             └─ B7 ─┴─ B8 ─ B9 ─ B10
F0 (socle) dès B1 terminé ; chaque écran F/M démarre seulement quand le lot B qui expose ses routes est terminé et documenté.
M0 (socle) dès B1 ; M-livreur après B6 ; M-commerçant au fil de B4, B5, B7, B8.
```

Règles :
1. **Un lot terminé avant le suivant** (`roadmap.md`), côté backend. Le front et le mobile peuvent avancer en parallèle **uniquement** sur des routes déjà livrées.
2. Un écran ne suppose jamais un champ, un statut ou une permission non documenté dans `backend/docs/routes/`. S'il manque quelque chose, on ouvre une tâche backend, on ne contourne pas côté client.
3. Aucune logique métier répliquée côté web ou mobile : le serveur est la source de vérité (statuts, droits, calculs de stock et de prix).
4. **Hors périmètre MVP partout** : paiements, commissions, notifications (push, e-mail, SMS), messagerie, WhatsApp, abonnements facturés, Redis, BullMQ, RabbitMQ, websockets, microservices.

---

## 2. Étapes standard d'une phase backend

Chaque phase B suit ces étapes ; elles sont cochées par lot dans `progress.md` (`Bn.S1` … `Bn.S10`).

| Étape | Contenu | Qui |
|---|---|---|
| S1 — Use cases | Fiche module → use cases détaillés, règles avec exemples, Gherkin français, plan TDD, traçabilité, liste des À VALIDER, dans `docs/use-cases/` | `use-case-writer` |
| S2 — Plan validé | Plan borné (skill `plan-avant-implementation`) : objectifs, fichiers, agrégats, migrations, routes, tests, risques. **Validation du user obligatoire** | session principale |
| S3 — Domaine (TDD) | Tests rouges puis agrégats, value objects, transitions gardées, `DomainException` catégorisées, événements | `back-builder` |
| S4 — Application (TDD) | Handlers `@Injectable()` avec ports par `@Inject(<SYMBOL>)`, queries sur un port de lecture (`application/ports/read-*.repository.ts`), doublures in-memory dans `src/modules/<module>/tests/doubles/`, tests `tests/unit/*.spec.ts` | `back-builder` |
| S5 — Persistance | Entité TypeORM `*.orm-entity.ts` aux noms de contraintes explicites, mapper, repository `*TypeOrmRepository` sur `TypeOrmDatabaseConnection.manager()`, migration TypeORM générée et relue (forward-only), `npm run migration:check` sans écart, contraintes SQL et index, verrous ou version optimiste | `back-builder` / `query-perf` |
| S6 — HTTP | Contrôleur mince, validation Zod `.strict()`, `AccessTokenGuard`, `agencyId` résolu côté serveur, 404 sur ressource d'une autre agence, Problem Details, pagination `{ items, nextCursor, hasMore }`, `Idempotency-Key` quand exigé, OpenAPI | `back-builder` |
| S7 — E2E | `test/e2e.cjs` sur base dédiée et vide : 200/201, 400, 401, 403, 404 autre agence, 409, pagination, concurrence quand un invariant l'exige | `back-builder` / `query-perf` |
| S8 — Docs | `backend/docs/routes/<groupe>.md`, `domains.md`, `events.md`, OpenAPI | `back-builder` |
| S9 — Revues | `security-reviewer` si CRITIQUE (les deux modes) ; `archi-reviewer` en mode full | agents de revue |
| S10 — Clôture | `lint`, `typecheck`, `build`, `test`, `test:e2e` réellement exécutés ; commit ; rapport au format de fin de lot ; mise à jour de `progress.md` | session principale |

---

## 3. Backend

### B0 — Socle technique (lot 0)
- **Objectif** : API NestJS strict qui démarre dans Docker avec PostgreSQL séparé, migrations, healthchecks, CI et tests.
- **Tâches**
  - B0.1 Projet NestJS 11, TypeScript strict, ESLint `--max-warnings=0`, `typecheck` sources + tests.
  - B0.2 `Dockerfile` multi-stage (build, runtime minimal, utilisateur non-root, gestion des signaux, healthcheck).
  - B0.3 `compose.yaml` (api + postgres séparés, volume, réseau privé, API après DB saine), `compose.dev.yaml` (hot reload), `compose.test.yaml` (base tmpfs), `compose.prod.yaml` (images versionnées, secrets externes, limites, redémarrage).
  - B0.4 `.dockerignore`, `.env.example` sans secret réel.
  - B0.5 Migrations versionnées forward-only, commande explicite `npm run migrate`, migrateur sérialisé (verrou consultatif) qui refuse un historique différent des fichiers.
  - B0.6 `GET /health/live` (sans DB) et `GET /health/ready` (DB + migrations), sans secret exposé.
  - B0.7 `ProblemDetailsFilter` RFC 9457, préfixe `/api/v1`, OpenAPI `/api/v1/docs`.
  - B0.8 Noyau partagé : `AggregateRoot`, `DomainEvent`, `DomainException`, `Clock`, `UuidGenerator`, `TypeOrmDatabaseConnection` (transaction par `AsyncLocalStorage`), `CursorPage`, `TransactionalCommandHandlerFactory`, `DomainEventPublisher`, `ZodValidationPipe`.
  - B0.9 Tests : `node:test` + `tsx`, doublures in-memory, specs dans `src/**/tests/`, `test/e2e.cjs` sur PostgreSQL réel.
  - B0.10 CI GitHub Actions `.github/workflows/backend.yml` : `npm ci`, lint, typecheck, build, test, test:e2e.
  - B0.11 Sauvegarde PostgreSQL chiffrée hors VPS, rétention, restauration testée — procédure documentée (`backend/docs/operations/exploitation.md`), **rétention et calendrier À VALIDER**, validation sur l'infrastructure cible à faire.
  - B0.12 *(ajoutée le 2026-11-03, décision D-01)* Architecture normalisée et passage à TypeORM, sans changement de contrat HTTP : arborescence et conventions de `docs/architecture/architecture-backend.md`, entités et migration de référence qui adopte une base Drizzle existante, `migration:check` sans écart, revue `security-reviewer` (périmètre critique : sessions, memberships, isolation).
- **Critère de sortie** : clone neuf + `.env` → `docker compose up --build` OK, `/health/ready` vert, E2E vert, `docker compose down` conserve les volumes.

### B1 — Identité, sessions, memberships, rôles (lot 1) — CRITIQUE
- **Fiche** : `modules/01-identite-acces.md`. **Modules** : `identity`, `agencies`.
- **Agrégats** : `User`, `Session`, `AgencyTeam` (memberships), `Invitation`.
- **Tâches**
  - B1.1 UC-01-01 Créer un compte — `POST /auth/register` (`individual` | `merchant`, Argon2id, e-mail normalisé unique, 409 si doublon).
  - B1.2 UC-01-02 Connexion — `POST /auth/login` (JWT 15 min + refresh opaque 30 jours haché SHA-256, même 401 pour compte inconnu et mauvais mot de passe).
  - B1.3 UC-01-03 Renouveler la session — `POST /auth/refresh` (rotation à usage unique, un seul succès en concurrence).
  - B1.4 UC-01-04 Révoquer la session — `POST /auth/logout`.
  - B1.5 Profil — `GET /me`.
  - B1.6 UC-01-05 Inviter un membre — `POST /agencies/{id}/invitations` (rôles `admin` | `agent`, 7 jours, usage unique).
  - B1.7 UC-01-06 Accepter une invitation — `POST /agency-invitations/accept` (adresse invitée, 404 uniforme, 409 si déjà membre).
  - B1.8 UC-01-07 Changer un rôle — `PATCH /agencies/{id}/members/{memberId}`.
  - B1.9 UC-01-08 Retirer un accès — `DELETE /agencies/{id}/members/{memberId}` (désactivation, pas de suppression physique).
  - B1.10 UC-01-09 Lister mes agences — `GET /me/agencies` (curseur).
  - B1.11 Rate limiting des routes d'authentification (en mémoire par instance aujourd'hui) ; **limitation partagée et proxy de confiance à prévoir avant la production**.
  - B1.12 Audit `identity_audit` de chaque événement, dans la transaction.
- **Règles** : RM-01-01 plusieurs agences par utilisateur ; RM-01-02 agence active validée par membership ; RM-01-03 pas d'auto-élévation ; RM-01-04 dernier propriétaire protégé (y compris en concurrence) ; RM-01-05 session révoquée interdite.
- **À VALIDER** : rôles exacts au-delà de `owner`/`admin`/`agent` ; validations humaines.
- **Critère de sortie** : anti-IDOR (404 autre agence), rotation du refresh, audit.

### B2 — Onboarding agence, capacités, sites, équipe (lot 2) — CRITIQUE (création du premier propriétaire)
- **Fiche** : `modules/02-agences-onboarding.md`. **Module** : `agencies`.
- **Agrégats candidats** : `Agency`, `AgencyLocation`, `Capability` (découpage à confirmer en Example Mapping).
- **Tâches**
  - B2.1 UC-02-01 Créer un brouillon d'agence — `POST /agencies` : crée l'agence au statut `draft` **et** le membership `owner` du créateur.
  - B2.2 UC-02-02 Compléter l'identité (raison sociale, contacts, ville…) — `PATCH /agencies/{id}`.
  - B2.3 UC-02-03 Renseigner les zones desservies.
  - B2.4 UC-02-04 Activer une capacité livraison ou stockage (hybride = les deux) — `POST /agencies/{id}/capabilities` ; configuration minimale exigée (RM-02-02).
  - B2.5 UC-02-05 Soumettre à vérification — `POST /agencies/{id}/submit` (`draft` → `submitted`, transition gardée).
  - B2.6 UC-02-06 Modifier le profil.
  - B2.7 UC-02-07 Suspendre une capacité (bloque les nouvelles demandes, garde l'historique — RM-02-03).
  - B2.8 UC-02-08 Gérer les sites (`AgencyLocation`) : créer, modifier, désactiver.
  - B2.9 Consulter l'état d'onboarding — `GET /agencies/{id}/onboarding`.
  - B2.11 *(ajoutée le 2026-11-04, revue sécurité)* `contactEmail` : refus des caractères de contrôle, format validé comme en B1.
  - B2.12 *(ajoutée le 2026-11-04, revue sécurité)* Audit des zones et sites avec l'identifiant de la ressource touchée.
  - B2.14 *(ajoutée le 2026-11-04, D-20)* `GET /agencies/{id}` (identité complète) réservée au propriétaire et à l'administrateur ; l'agent reçoit 403.
  - B2.15 *(ajoutée le 2026-11-04, contre-revue sécurité, durcissement)* Droits d'agence en liste autorisée exhaustive (`Record<AgencyRole, boolean>`) avant tout nouveau rôle (B6, B10).
  - B2.13 *(ajoutée le 2026-11-04, revue sécurité, durcissement)* Agrégat `Agency` borné (plafonds, chargement des données actives) ; membership vérifié avant le verrou.
  - B2.10 *(ajoutée le 2026-11-04, anomalie A-09 des use cases)* Lister les membres d'une agence — `GET /agencies/{id}/members` (curseur, membres actifs de l'agence de l'appelant uniquement) ; nécessaire à F1.3.
- **Règles** : RM-02-01 agence non approuvée peut rester brouillon ; RM-02-02 capacité = configuration minimale ; RM-02-03 suspension sans effacement ; RM-02-04 vérification ≠ assurance.
- **Événements** : `AgencyRegistered`, `AgencyCapabilityEnabled` (+ audit).
- **Use cases** : `docs/use-cases/02-agences-onboarding/` (S1, 2026-11-04). **Décisions prises le 2026-11-04** (détail dans `progress.md`) : D-04 (identité, configuration minimale, statuts), D-13 (propriétaire + administrateur configurent, propriétaire seul soumet), D-14 (`Idempotency-Key` à la création, 409 sur second envoi), D-15 (zone desservie = zone tarifaire de B3).
- **À VALIDER** : champs et documents obligatoires de l'identité ; configuration minimale de chaque capacité ; statuts après `submitted` (approbation en B10/admin) ; critères de certification, responsables, expiration.
- **Critère de sortie** : agence brouillon → soumise, validations, isolation entre agences.

### B3 — Tarifs, zones, profils publics, recherche marketplace (lot 3) — CRITIQUE (routes publiques)
- **Fiches** : `modules/05-tarifs-zones.md`, `modules/03-marketplace.md` (partie publique). **Modules** : `pricing`, `marketplace`.
- **Agrégats candidats** : `ServiceZone`, `RateCard`, `Quote`, `AgencyPublicProfile`.
- **Tâches pricing**
  - B3.1 UC-05-01 Créer une zone — `POST /zones`.
  - B3.2 UC-05-02 Modifier une zone — `PATCH /zones/{id}`.
  - B3.3 UC-05-03 Désactiver une zone (interdit les nouvelles commandes — RM-05-02).
  - B3.4 UC-05-04 Créer une grille tarifaire — `POST /rate-cards` (unités poids/volume explicites — RM-05-03).
  - B3.5 UC-05-05 Versionner une grille — `PATCH /rate-cards/{id}` crée une nouvelle version, l'ancienne reste historisée.
  - B3.6 UC-05-06 Simuler un prix — `POST /quotes/preview` (arrondi monétaire FCFA cohérent — RM-05-04).
  - B3.7 UC-05-07 Émettre un devis.
  - B3.8 UC-05-08 Accepter un devis (prix figé à l'acceptation — RM-05-01).
- **Tâches marketplace publique**
  - B3.9 UC-03-01 Publier la fiche publique (projection explicitement autorisée, aucun client interne — RM-03-01).
  - B3.10 UC-03-02 Rechercher — `GET /public/agencies` (paginée par curseur, sans authentification).
  - B3.11 UC-03-03 Filtrer par zone et capacité.
  - B3.12 UC-03-04 Consulter une fiche — `GET /public/agencies/{slug}`.
  - B3.13 Index et EXPLAIN de la recherche (agent `query-perf`), rate limiting des routes publiques.
  - B3.14 *(ajoutée le 2026-11-04, anomalie A-35 des use cases)* Lire la grille tarifaire et l'historique de ses versions (tout membre actif, curseur).
  - B3.15 *(ajoutée le 2026-11-04, anomalie A-35 des use cases)* Lister et consulter les devis de l'agence (tout membre actif, curseur).
  - B3.16 *(ajoutée le 2026-11-05)* Rendre déterministe le test E2E de course de versionnement de grille (instable vu une fois).
- **Règles** : RM-05-05 tarifs propres à chaque agence ; RM-03-05 tarifs affichés non garantis sans devis.
- **Événements** : projection publique alimentée par `AgencyCapabilityEnabled` (in-process tant qu'aucun besoin inter-domaines n'est validé).
- **Use cases** : `docs/use-cases/05-tarifs-zones/` et `docs/use-cases/03-marketplace-publique/` (S1, 2026-11-04). Publication tranchée (D-05) : agence soumise publiable avec la mention « non vérifiée ».
- **Décisions prises le 2026-11-04** : barème, taxes et arrondi (D-05), grille et devis (D-22), fiche publique (D-23), recherche publique (D-24), modification d’une zone (D-25) — détail dans `progress.md`. Plus aucun À VALIDER bloquant pour B3.
- **Critère de sortie** : recherches paginées, projections publiques sans fuite.

### B4 — Clients, profils commerçants, demandes de services (lot 4) — CRITIQUE (données personnelles, marketplace)
- **Fiches** : `modules/04-clients-commercants.md`, `modules/03-marketplace.md` (demandes). **Modules** : `customers`, `merchants`, `marketplace`.
- **Agrégats candidats** : `AgencyCustomer`, `MerchantProfile`, `ServiceRequest`.
- **Tâches clients et commerçants**
  - B4.1 UC-04-01 Créer un client d'agence — `POST /customers` (privé à l'agence — RM-04-01).
  - B4.2 UC-04-02 Modifier — `PATCH /customers/{id}`.
  - B4.3 UC-04-03 Fusionner des doublons de façon contrôlée (contact unique non présumé — RM-04-04).
  - B4.4 UC-04-04 Archiver — `POST /customers/{id}/archive` (pas de suppression physique avec historique — RM-04-03).
  - B4.5 UC-04-05 Consulter l'historique d'un client.
  - B4.6 Lister et rechercher les clients — `GET /customers` (curseur).
  - B4.7 UC-04-06 Créer le profil commerçant — `POST /merchants/profile` (compte `merchant`).
  - B4.8 UC-04-07 Associer un commerçant à plusieurs agences (RM-04-02).
- **Tâches demandes marketplace**
  - B4.9 UC-03-05 Demander une prestation — `POST /service-requests` (client ou commerçant authentifié).
  - B4.10 UC-03-06 Retirer sa demande.
  - B4.11 Lister les demandes (côté agence destinataire et côté demandeur) — `GET /service-requests`.
  - B4.12 UC-03-07 Accepter une demande — `POST /service-requests/{id}/accept` avec `Idempotency-Key`, acceptation unique garantie en base (RM-03-04), test de concurrence.
  - B4.13 Refuser une demande — `POST /service-requests/{id}/reject` (refus audité — RM-03-03).
  - B4.14 Endpoints commerçant (mobile/web) : ses demandes et ses profils d'agence, sans exposer les clients internes d'une agence.
- **Règles** : RM-03-02 une demande n'est **pas** une commande (aucune commande n'existe avant acceptation).
- **Événements** : `ServiceRequestSubmitted`, `ServiceRequestAccepted` (sans notification externe).
- **À VALIDER** : acceptation automatique ou manuelle ; conservation et export/suppression des données personnelles.
- **Critère de sortie** : demande ≠ commande, acceptation idempotente.

### B5 — Commandes, colis, journal de suivi (lot 5) — CRITIQUE (suivi public par jeton)
- **Fiches** : `modules/06-commandes.md`, `modules/07-colis-suivi.md`. **Modules** : `orders`, `parcels`, `tracking`.
- **Agrégats candidats** : `Order`, `Parcel`, `TrackingEvent` (append-only).
- **Tâches commandes**
  - B5.1 UC-06-01 Créer une commande manuelle — `POST /orders` avec `Idempotency-Key` (possible sans marketplace — RM-06-02).
  - B5.2 UC-06-02 Créer la commande issue d'une demande acceptée (`request_id` facultatif, orchestration idempotente).
  - B5.3 UC-06-03 Modifier avant prise en charge — `PATCH /orders/{id}` (version optimiste — RM-06-05, `If-Match`).
  - B5.4 UC-06-04 Confirmer — `POST /orders/{id}/confirm`.
  - B5.5 UC-06-05 Annuler sous conditions — `POST /orders/{id}/cancel` (après prise en charge → retour/incident — RM-06-04).
  - B5.6 UC-06-06 Lister — `GET /orders` (index `orders(agency_id, created_at, id)` et `(agency_id, status, created_at)`).
  - B5.7 UC-06-07 Consulter — `GET /orders/{id}`.
  - B5.8 UC-06-08 Rechercher (filtres en allowlist).
  - B5.9 UC-06-09 Historiser chaque transition (statut terminal non réouvert — RM-06-03).
- **Tâches colis et suivi**
  - B5.10 UC-07-01 Ajouter un colis — `POST /orders/{id}/parcels` (plusieurs colis par commande — RM-07-01).
  - B5.11 UC-07-02 Modifier les caractéristiques avant le premier scan — `PATCH /parcels/{id}`.
  - B5.12 UC-07-03 Recevoir — `POST /parcels/{id}/receive`.
  - B5.13 UC-07-04 Scanner — `POST /parcels/{id}/events` (scan dupliqué idempotent — RM-07-04).
  - B5.14 UC-07-05 Enregistrer une anomalie.
  - B5.15 UC-07-06 Chronologie interne — `GET /parcels/{id}/tracking` (statut courant dérivé — RM-07-03).
  - B5.16 UC-07-07 Suivi public par jeton (aucune adresse exposée — RM-07-05).
  - B5.17 Endpoints commerçant : ses commandes et leurs colis.
- **Événements** : `OrderCreated`, `ParcelReceived`.
- **À VALIDER** : liste des statuts et transitions approuvés par les opérateurs ; contenu du suivi public ; durée de vie du jeton public.
- **Critère de sortie** : statuts protégés et historique complet.

### B6 — Livreurs, missions, endpoints mobile livreur (lot 6) — CRITIQUE (preuves, géolocalisation, données livreurs)
- **Fiches** : `modules/08-livreurs.md`, `modules/09-missions-mobile.md`. **Modules** : `couriers`, `dispatch`.
- **Agrégats candidats** : `Courier`, `CourierAvailability`, `DeliveryTask`, `ProofOfDelivery`.
- **Tâches livreurs**
  - B6.1 UC-08-01 Inviter un livreur — `POST /couriers` (compte mobile lié à une identité vérifiée — RM-08-04).
  - B6.2 UC-08-02 Activer.
  - B6.3 UC-08-03 Suspendre — `POST /couriers/{id}/suspend` (plus de nouvelle mission — RM-08-02).
  - B6.4 UC-08-04 Assigner des zones.
  - B6.5 UC-08-05 Définir sa disponibilité — `PATCH /couriers/me/availability`.
  - B6.6 UC-08-06 Consulter la charge — `GET /couriers`.
  - B6.7 UC-08-07 Désactiver (anciennes missions traçables — RM-08-03).
- **Tâches missions**
  - B6.8 UC-09-01 Créer une mission — `POST /delivery-tasks`.
  - B6.9 UC-09-02 Affecter — `POST /delivery-tasks/{id}/assign`.
  - B6.10 UC-09-03 Réaffecter.
  - B6.11 UC-09-04 Accepter (livreur) — `POST /delivery-tasks/{id}/accept`.
  - B6.12 UC-09-05 Démarrer — `POST /delivery-tasks/{id}/start`.
  - B6.13 UC-09-06 Enregistrer une tentative — `POST /delivery-tasks/{id}/attempt` (échec ≠ annulation de commande — RM-09-04).
  - B6.14 UC-09-07 Terminer — `POST /delivery-tasks/{id}/complete` (tâche terminée immuable — RM-09-02).
  - B6.15 UC-09-08 Joindre une preuve (upload : MIME réel, taille, chemin, URL signée courte — RM-09-03).
  - B6.16 UC-09-09 Signaler un incident.
  - B6.17 Mes missions — `GET /courier/me/tasks` (le livreur ne voit que ses missions — RM-09-01).
  - B6.18 Mode hors ligne : identifiant d'action idempotent, horodatage source, reprise explicite, serveur source de vérité.
- **Règles** : RM-09-05 pas de position GPS continue par défaut.
- **Événements** : `DeliveryTaskAssigned`, `DeliveryCompleted`.
- **À VALIDER** : preuves acceptées (photo, signature, code) et conservation ; attribution et validation des comptes livreurs ; visibilité de la géolocalisation ; stockage des fichiers (disque, objet S3-compatible).
- **Critère de sortie** : assignation, tentative, preuve de livraison, reprise hors ligne.

### B7 — Entrepôts, réception, inventaire, réservations (lot 7) — concurrence stock
- **Fiches** : `modules/10-entrepots.md`, `modules/11-inventaire.md`. **Modules** : `warehouses`, `inventory`.
- **Agrégats candidats** : `Warehouse`, `StorageBin`, `StockLot`, `StockMovement` (append-only), `Reservation`.
- **Tâches entrepôts**
  - B7.1 UC-10-01 Créer un entrepôt — `POST /warehouses` (agence stockage ou hybride — RM-10-01).
  - B7.2 UC-10-02 Modifier — `PATCH /warehouses/{id}`.
  - B7.3 UC-10-03 Archiver (refusé avec stock actif — RM-10-02).
  - B7.4 UC-10-04 Créer un emplacement — `POST /warehouses/{id}/bins`.
  - B7.5 UC-10-05 Bloquer un emplacement — `PATCH /bins/{id}` (plus d'entrée — RM-10-04).
  - B7.6 UC-10-06 Consulter la capacité (jamais négative — RM-10-03).
  - B7.7 UC-10-07 Lister les mouvements (curseur).
- **Tâches inventaire**
  - B7.8 UC-11-01 Créer un avis de réception — `POST /receipts`.
  - B7.9 UC-11-02 Réceptionner — `POST /receipts/{id}/receive`.
  - B7.10 UC-11-03 Mettre en quarantaine.
  - B7.11 UC-11-04 Libérer de quarantaine.
  - B7.12 UC-11-05 Ajuster avec motif — `POST /inventory/adjustments`.
  - B7.13 UC-11-06 Réserver — `POST /inventory/reservations` (verrou ou contrainte, **test de concurrence « dernière unité »**).
  - B7.14 UC-11-07 Libérer une réservation — `POST /inventory/reservations/{id}/release`.
  - B7.15 UC-11-08 Inventorier.
  - B7.16 Consulter le stock — `GET /inventory` (index `stock(agency_id, warehouse_id, sku)`).
  - B7.17 Endpoints commerçant : son stock dans chaque agence (propriété conservée — RM-11-03).
- **Règles** : RM-11-01 disponible = physique − réservé − bloqué ; RM-11-02 jamais négatif ; RM-11-04 mouvements append-only ; RM-11-05 concurrence protégée.
- **Événements** : `StockReserved`, `StockReleased`.
- **Critère de sortie** : stock jamais négatif en concurrence (scénario BDD d'`acceptance.md`).

### B8 — Préparation, sorties, transferts inter-agences (lot 8) — CRITIQUE (transferts)
- **Fiches** : `modules/12-preparation.md`, `modules/13-transferts.md`. **Modules** : `fulfillment`, `transfers`.
- **Agrégats candidats** : `FulfillmentOrder`, `PickTask`, `Transfer`, `Handover`.
- **Tâches préparation**
  - B8.1 UC-12-01 Créer un ordre de préparation — `POST /fulfillments`.
  - B8.2 UC-12-02 Réserver le stock — `POST /fulfillments/{id}/reserve` (atomique — RM-12-01, rupture explicite — RM-12-04).
  - B8.3 UC-12-03 Préparer.
  - B8.4 UC-12-04 Confirmer le picking — `POST /fulfillments/{id}/pick` (pas de double consommation — RM-12-02).
  - B8.5 UC-12-05 Emballer — `POST /fulfillments/{id}/pack`.
  - B8.6 UC-12-06 Remettre au transporteur — `POST /fulfillments/{id}/handover` (sortie de stock seulement à la remise confirmée — RM-12-03).
  - B8.7 UC-12-07 Annuler sous conditions.
- **Tâches transferts**
  - B8.8 UC-13-01 Demander un transfert — `POST /transfers` avec `Idempotency-Key`.
  - B8.9 UC-13-02 Accepter côté destination — `POST /transfers/{id}/accept` (consentement explicite — RM-13-02).
  - B8.10 UC-13-03 Préparer.
  - B8.11 UC-13-04 Expédier — `POST /transfers/{id}/dispatch`.
  - B8.12 UC-13-05 Attester la remise (preuve — RM-13-04).
  - B8.13 UC-13-06 Attester la réception — `POST /transfers/{id}/receive`.
  - B8.14 UC-13-07 Signaler un écart — `POST /transfers/{id}/dispute` (litige — RM-13-05).
  - B8.15 UC-13-08 Clôturer.
  - B8.16 Accès inter-agences strictement borné à l'objet transfert (RM-13-06), propriété du stock inchangée (RM-13-03), tests anti-fuite.
- **Événements** : `TransferDispatched`, `TransferReceived`.
- **À VALIDER** : responsabilité inter-agences, SLA, politique en cas d'écart.
- **Critère de sortie** : preuve de garde complète et isolation inter-agences.

### B9 — Retours, incidents, réclamations (lot 9) — CRITIQUE (preuves)
- **Fiche** : `modules/14-retours-incidents.md`. **Modules** : `returns`, `claims`.
- **Agrégats candidats** : `ReturnCase`, `Incident`, `Claim`.
- **Tâches**
  - B9.1 UC-14-01 Signaler un échec (la commande n'est pas supprimée — RM-14-01).
  - B9.2 UC-14-02 Ouvrir un retour — `POST /returns`.
  - B9.3 UC-14-03 Autoriser — `POST /returns/{id}/authorize`.
  - B9.4 UC-14-04 Suivre (chaîne de garde conservée — RM-14-02).
  - B9.5 UC-14-05 Réceptionner le retour — `POST /returns/{id}/receive` (mouvement de stock explicite — RM-14-03).
  - B9.6 UC-14-06 Ouvrir une réclamation — `POST /claims`.
  - B9.7 UC-14-07 Documenter — `PATCH /claims/{id}` (accès aux preuves limité — RM-14-04).
  - B9.8 UC-14-08 Clôturer.
- **À VALIDER** : politique de retours, colis perdus, litiges, SLA.
- **Critère de sortie** : chaînes de responsabilité conservées.

### B10 — Dashboard, exports, admin plateforme, durcissement (lot 10) — CRITIQUE (admin, lecture globale)
- **Fiches** : `modules/15-admin.md`, `modules/16-rapports.md`. **Modules** : `admin`, `reporting`.
- **Tâches admin plateforme**
  - B10.1 Rôle administrateur plateforme distinct de l'administrateur d'agence (RM-15-01).
  - B10.2 UC-15-01 Examiner une agence — `GET /admin/agencies`.
  - B10.3 UC-15-02 Demander un justificatif.
  - B10.4 UC-15-03 Approuver ou rejeter — `POST /admin/agencies/{id}/verify`.
  - B10.5 UC-15-04 Suspendre — `POST /admin/agencies/{id}/suspend` (historique conservé — RM-15-03).
  - B10.6 UC-15-05 Restaurer.
  - B10.7 UC-15-06 Modérer un profil public.
  - B10.8 UC-15-07 Consulter l'audit — `GET /admin/audit` (aucune lecture globale sans rôle et justification — RM-15-04).
- **Tâches rapports**
  - B10.9 UC-16-01 KPI agence — `GET /reports/overview`.
  - B10.10 UC-16-02 Volumes — `GET /reports/orders`.
  - B10.11 UC-16-03 Délais.
  - B10.12 UC-16-04 Échecs.
  - B10.13 UC-16-05 Occupation du stock — `GET /reports/warehouse`.
  - B10.14 UC-16-06 Performance des livreurs — `GET /reports/couriers`.
  - B10.15 UC-16-07 Exports autorisés.
  - B10.16 Règles : statistiques isolées par agence (RM-16-01), dérivées des événements réels (RM-16-02), période et fuseau explicites (RM-16-03), aucun montant de paiement inventé (RM-16-04).
- **Tâches durcissement**
  - B10.17 Mesures de performance (50 agences / 5 000 commandes mensuelles, pics réalistes, contention de réservation).
  - B10.18 Revue sécurité globale, correlationId dans les logs, logs sans secret.
  - B10.19 Rate limiting partagé, évaluation RLS PostgreSQL en défense supplémentaire.
  - B10.20 Sauvegarde et restauration validées sur l'infrastructure cible.
  - B10.21 *(ajoutée le 2026-11-04)* Purge des `idempotency_keys` (table introduite en B2.1) selon la rétention décidée (D-16).
- **À VALIDER** : responsables de validation des agences ; quotas des abonnements (facturation reportée).
- **Critère de sortie** : mesures, audit, performances.

---

## 4. Frontend web

Chaque phase F démarre quand les routes backend qu'elle consomme sont livrées. Skill `core-front-stack` obligatoire (référence `nextjs.md` ou `vite-rtk.md` + `backend-integration.md`).

### F0 — Socle commun web (après B1)
- F0.1 Outillage partagé des trois applications : TypeScript strict, ESLint, Prettier, alias `@/`, Tailwind, shadcn/ui, i18n (français par défaut).
- F0.2 Génération des types clients depuis l'OpenAPI `/api/v1/docs` (un client typé partagé), validation Zod des réponses à la frontière.
- F0.3 Client HTTP centralisé : préfixe `/api/v1`, Problem Details → erreurs de champ (400), 401 → reconnexion, 403 masqué, 404, 409, 5xx ; pagination `{ items, nextCursor, hasMore }`.
- F0.4 **Stratégie de jetons web — À VALIDER** : l'API renvoie aujourd'hui `accessToken` et `refreshToken` dans le corps JSON ; jamais de `localStorage`. Options : BFF (route handlers Next.js / petit serveur) qui garde le refresh en cookie `HttpOnly`, ou évolution de l'API pour poser elle-même un cookie `HttpOnly` + protection CSRF. Décision à prendre avant F1.1 ; si l'API change, c'est une tâche backend CRITIQUE.
- F0.5 Tests : Vitest + Testing Library (unitaires et composants), Playwright (parcours critiques).
- F0.6 Docker et CI front (build, lint, typecheck, tests) — agent `infra-devops`.

### F1 — Back-office agence (`frontend/admin-back-office-agence`, Vite + RTK)
- F1.1 Connexion, déconnexion, renouvellement de session, profil (`/auth/*`, `/me`) — après B1.
- F1.2 Sélecteur d'agence active (`/me/agencies`), garde de routes par rôle (`owner`, `admin`, `agent`) — après B1.
- F1.3 Équipe : liste des membres, invitation (affichage unique du jeton), changement de rôle, retrait d'accès — après B1 (liste des membres : route à ajouter côté backend si absente).
- F1.4 Onboarding : création de l'agence, identité, zones, capacités, sites, soumission, état d'onboarding — après B2.
- F1.5 Zones et grilles tarifaires (versions), simulateur de prix, devis — après B3.
- F1.6 Fiche publique de l'agence (aperçu et publication) — après B3.
- F1.7 Clients d'agence : liste, création, modification, fusion, archivage, historique — après B4.
- F1.8 Demandes reçues : liste, acceptation (avec `Idempotency-Key`), refus — après B4.
- F1.9 Commandes : liste filtrée, création manuelle, détail, modification avant prise en charge, confirmation, annulation — après B5.
- F1.10 Colis : ajout, réception, scan, anomalies, chronologie — après B5.
- F1.11 Livreurs : invitation, activation, suspension, zones, charge — après B6.
- F1.12 Dispatch : création de missions, affectation, réaffectation, suivi des tentatives et preuves — après B6.
- F1.13 Entrepôts et emplacements, capacité, mouvements — après B7.
- F1.14 Réceptions, quarantaine, ajustements, réservations, inventaire — après B7.
- F1.15 Préparation : ordres, picking, emballage, remise — après B8.
- F1.16 Transferts inter-agences : demande, acceptation, expédition, remise, réception, écarts — après B8.
- F1.17 Retours, incidents, réclamations — après B9.
- F1.18 Dashboard et exports de l'agence — après B10.

### F2 — Front-office public (`frontend/front-office`, Next.js App Router)
- F2.1 Pages publiques : accueil, présentation, mentions légales ; SEO (métadonnées, sitemap) — après F0.
- F2.2 Inscription particulier ou commerçant, connexion, compte — après B1 et F0.4.
- F2.3 Annuaire des agences : recherche, filtres zone et capacité, pagination — après B3.
- F2.4 Fiche publique d'une agence (`/agences/{slug}`), tarifs indicatifs non garantis — après B3.
- F2.5 Demande de prestation, liste de mes demandes, retrait — après B4.
- F2.6 Espace commerçant web : profil commerçant, agences associées, commandes, stock — après B4, B5, B7.
- F2.7 Suivi public d'un colis par jeton, sans adresse — après B5.

### F3 — Administration plateforme (`frontend/admin-platform`, Vite + RTK)
- F3.1 Connexion réservée au rôle administrateur plateforme — après B10.1.
- F3.2 File de vérification des agences : examen, demande de justificatif, approbation, rejet — après B10.
- F3.3 Suspension et restauration d'agences, modération des profils publics — après B10.
- F3.4 Consultation de l'audit (filtres, pagination, justification d'accès) — après B10.
- F3.5 Statistiques plateforme agrégées — après B10.

---

## 5. Mobile (React Native + Expo)

### M0 — Socle mobile (après B1)
- M0.1 **Organisation — À VALIDER** : deux applications (`mobile/courier`, `mobile/merchant`) partageant un paquet commun (client API typé, auth, UI), ou une seule application avec deux profils. Recommandation : deux applications, permissions et stores séparés.
- M0.2 Expo + TypeScript strict, navigation, i18n français, thème.
- M0.3 Client API typé généré depuis l'OpenAPI, gestion Problem Details.
- M0.4 Authentification : login, refresh rotatif, logout ; jetons dans `expo-secure-store` uniquement.
- M0.5 File d'actions hors ligne : identifiant d'action idempotent, horodatage source, reprise explicite, résolution des conflits côté serveur.
- M0.6 Tests (Jest imposé par Expo pour le mobile, à confirmer), build EAS, CI mobile — agent `infra-devops`.

### M1 — Application livreur (après B6)
- M1.1 Connexion du livreur (compte lié à une identité vérifiée).
- M1.2 Mes missions du jour et à venir (`/courier/me/tasks`).
- M1.3 Accepter et démarrer une mission.
- M1.4 Détail de la mission : adresse, contact, colis (données strictement nécessaires).
- M1.5 Enregistrer une tentative échouée avec motif.
- M1.6 Terminer avec preuve de livraison (photo, signature ou code selon la politique validée), upload résilient.
- M1.7 Signaler un incident.
- M1.8 Définir sa disponibilité.
- M1.9 Fonctionnement hors ligne complet et resynchronisation.
- M1.10 Aucune position GPS continue par défaut (RM-09-05).

### M2 — Application commerçant (au fil de B4, B5, B7, B8)
- M2.1 Connexion et profil commerçant — après B4.
- M2.2 Agences associées, recherche d'agence, demande de prestation et suivi des demandes — après B4.
- M2.3 Mes commandes et le suivi de leurs colis — après B5.
- M2.4 Mon stock par agence et par entrepôt — après B7.
- M2.5 Suivi des préparations et transferts qui concernent mon stock — après B8.
- M2.6 Retours et réclamations sur mes commandes — après B9.

---

## 6. Plus tard (hors MVP, nouvelle décision métier exigée)

Notifications, messagerie, paiements et commissions, abonnements facturés, intégrations externes (WhatsApp, transporteurs), outbox et broker si un besoin inter-domaines réel est validé.
