# Progression — agenceslivraison

Tableau de bord vivant du projet. Le détail de chaque tâche (règles, endpoints, critères de sortie) est dans [phases.md](phases.md), avec les **mêmes identifiants**.

## Règles de mise à jour (obligatoires)

1. **Avant une tâche** : lire ce fichier et la phase concernée de `phases.md` ; situer la tâche par son identifiant (`B2.4`, `F1.3`, `M1.6`…) et la passer en `[~]` dans « En cours ».
2. **Après une tâche** (session principale ou agent qui modifie des fichiers) : cocher, ajouter une ligne au journal, mettre à jour « En cours », le tableau de synthèse et les décisions. Dans le même commit que le travail.
3. Un agent de revue (`archi-reviewer`, `security-reviewer`) ne modifie pas ce fichier : il termine son rapport par une section « Mise à jour de progress.md » que la session principale applique.
4. **Ne cocher `[x]` que ce qui est vérifié** : tests réellement exécutés et verts, ou livrable constaté. Sinon `[~]` avec la raison.
5. Une tâche découverte en cours de route est ajoutée ici (et dans `phases.md` si elle change le plan) au lieu d'être faite en silence.

**Légende** : `[ ]` à faire · `[~]` en cours ou partiel · `[x]` fait et vérifié · `[!]` bloqué (décision À VALIDER ou dépendance)

---

## En cours

| Élément | Valeur |
|---|---|
| Lot backend courant | B3 — tarifs, zones, marketplace publique : S2 validé (2026-11-04, 5 tranches) ; tranche 1 en cours |
| Branche | `refactor/architecture-normalisee` |
| Mode de session | light (session du 2026-11-03) |
| Tâches en cours | `[~]` B3 tranche 3 — devis (B3.7, B3.8, B3.15) (`back-builder`) |

### Refactor architecture + TypeORM — commité (2026-11-03)
Le refactor signalé plus tôt est terminé et commité (`293a35b`) : D-01 tranchée en faveur de TypeORM et de l'architecture normalisée. `CLAUDE.md`, les agents (`back-builder`, `archi-reviewer`, `query-perf`), `phases.md` et `backend/docs/` sont alignés. Décision et conventions : [docs/architecture/](docs/architecture/).

---

## Synthèse

| Phase | Intitulé | Statut | Avancement |
|---|---|---|---|
| B0 | Socle technique | terminé (sauvegarde à valider en cible) | 11/12 |
| B1 | Identité, sessions, memberships | terminé, re-vérifié après refactor (rate limit partagé et constats de revue B1.13–B1.14 à traiter) | 11/14 |
| B2 | Onboarding agence | **terminé** (S1–S10) ; durcissements B2.13 et B2.15 livrés en tranche 1 de B3 | 15/15 |
| B3 | Tarifs, zones, marketplace publique | en cours (S1, S2 faits ; tranches 1 et 2 faites) | 7/15 |
| B4 | Clients, commerçants, demandes | à faire | 0/14 |
| B5 | Commandes, colis, suivi | à faire | 0/17 |
| B6 | Livreurs, missions | à faire | 0/18 |
| B7 | Entrepôts, inventaire | à faire | 0/17 |
| B8 | Préparation, transferts | à faire | 0/16 |
| B9 | Retours, réclamations | à faire | 0/8 |
| B10 | Admin, rapports, durcissement | à faire | 0/20 |
| F0 | Socle web | à faire | 0/6 |
| F1 | Back-office agence | à faire | 0/18 |
| F2 | Front-office public | à faire | 0/7 |
| F3 | Admin plateforme | à faire | 0/5 |
| M0 | Socle mobile | à faire | 0/6 |
| M1 | App livreur | à faire | 0/10 |
| M2 | App commerçant | à faire | 0/6 |

---

## Backend

### B0 — Socle technique
- [x] B0.1 NestJS strict, ESLint, typecheck
- [x] B0.2 Dockerfile multi-stage
- [x] B0.3 compose base, dev, test, prod
- [x] B0.4 `.dockerignore`, `.env.example`
- [x] B0.5 Migrations forward-only, `npm run migrate` (TypeORM depuis B0.12)
- [x] B0.6 `/health/live` et `/health/ready`
- [x] B0.7 Problem Details, `/api/v1`, OpenAPI
- [x] B0.8 Noyau partagé (`src/shared/`)
- [x] B0.9 Tests unitaires et `test/e2e.cjs`
- [x] B0.10 CI `.github/workflows/backend.yml`
- [~] B0.11 Sauvegarde chiffrée hors VPS — procédure documentée, restauration testée en local ; rétention, calendrier et validation sur l'infrastructure cible restent à faire
- [x] B0.12 Architecture normalisée + passage à TypeORM (commit `293a35b`, corrections de revue ensuite) — lint, typecheck, 49 tests unitaires, build, E2E Docker (aussi avec `TEST_LEGACY=1`), `migration:check` sans écart sur base neuve et sur base Drizzle existante, refus d'un historique Drizzle partiel, `npm audit --omit=dev` à 0 : vérifiés. Revue `security-reviewer` faite le 2026-11-03 : aucun critique, isolation, verrous `FOR UPDATE`, authentification et secrets jugés sains. Corrections appliquées et vérifiées (lint, typecheck, 58/58 tests, build, E2E Docker, adoption Drizzle sur PostgreSQL réel) ; non re-revues par `security-reviewer` :
  - [x] R1 *(à corriger)* E2E : 404 sur `POST /agencies/{autre}/invitations` et double acceptation concurrente d'une invitation (une seule réussit)
  - [x] R2 *(régression du refactor)* `TypeOrmDatabaseConnection.open()` : une requête concurrente pendant la première ouverture voit `isInitialized` avant la fin de `initialize()` → 500 ; attendre la promesse d'ouverture en cours — drapeau `ready` posé à la résolution, nouvelle tentative après échec, 3 tests unitaires
  - [x] R3 *(régression du refactor)* adoption d'une base Drizzle : les 7 empreintes et horodatages Drizzle d'origine sont comparés et les 4 index uniques critiques vérifiés (`drizzle-adoption.ts`, 6 tests unitaires) ; base authentique adoptée, empreinte, horodatage ou index modifiés refusés sur PostgreSQL réel. Contrôle par empreinte des migrations TypeORM : décision D-12
  - [x] R4 *(durcissement)* `invalidWhereValuesBehavior: { undefined: 'throw', null: 'throw' }` dans la configuration TypeORM
  - [ ] R5 *(note, suivie en B10.18)* journalisation des erreurs : ne jamais écrire un `QueryFailedError` entier (il porte SQL et paramètres), seulement code, contrainte et `traceId`

### B1 — Identité, sessions, memberships, rôles (CRITIQUE)
- [x] B1.1 `POST /auth/register`
- [x] B1.2 `POST /auth/login`
- [x] B1.3 `POST /auth/refresh` (rotation, concurrence)
- [x] B1.4 `POST /auth/logout`
- [x] B1.5 `GET /me`
- [x] B1.6 `POST /agencies/{id}/invitations`
- [x] B1.7 `POST /agency-invitations/accept`
- [x] B1.8 `PATCH /agencies/{id}/members/{memberId}`
- [x] B1.9 `DELETE /agencies/{id}/members/{memberId}`
- [x] B1.10 `GET /me/agencies`
- [~] B1.11 Rate limiting — en mémoire par instance ; limitation partagée et proxy de confiance avant production
- [x] B1.12 Audit `identity_audit`
- [ ] B1.13 *(constat revue 2026-11-03, antérieur au refactor)* Réutilisation d'un ancien refresh token : renvoie 401 sans révoquer la session (pas de détection de vol) — décider s'il faut révoquer
- [ ] B1.14 *(constat revue 2026-11-03, antérieur au refactor)* `POST /auth/register` répond 409 sur e-mail existant, ce qui révèle l'existence d'un compte — décider la politique

> État B0/B1 relevé dans `backend/docs/` et le code au 2026-11-03, puis re-vérifié après le refactor `293a35b` : tous les parcours B1 sont couverts par `test/e2e.cjs`, passé dans Docker le 2026-11-03.

### B2 — Onboarding agence (CRITIQUE)
Étapes : [x] S1 use cases (9 UC, 111 scénarios, 112 tests prévus) · [x] S2 plan validé (2026-11-04, 4 tranches : 1) B2.1+B2.9, 2) B2.2+B2.6, 3) B2.3+B2.8+B2.4+B2.7, 4) B2.5+B2.10) · [x] S3 domaine · [x] S4 application · [x] S5 persistance · [x] S6 HTTP · [x] S7 E2E · [x] S8 docs · [x] S9 revues (`security-reviewer` 2026-11-04 : aucun critique ; 2 à corriger → B2.11, B2.12 ; durcissements → B2.13, B3.9 ; pas d'`archi-reviewer`, mode light ; contre-revue des corrections B2.11, B2.12, B2.14 : C1, C2 et D-20 fermés, aucun critique ni à corriger) · [x] S10 clôture (2026-11-04, suite complète exécutée par la session principale)
- [x] B2.1 Créer brouillon + premier propriétaire — `POST /agencies`, agence + équipe dans une transaction, `Idempotency-Key` (rejeu, conflit, concurrence testés)
- [x] B2.2 Compléter l'identité — `PATCH /agencies/{id}/identity` (brouillon seulement, `If-Match`, 428 / 409) ; lecture ajoutée hors plan : `GET /agencies/{id}` (version, `ETag`)
- [x] B2.3 Zones desservies — `POST|DELETE|GET /agencies/{id}/zones` (retrait logique, réactivation avec le même id, 100 actives max, table `service_zones` réutilisable par B3 via `(agency_id, id)` — D-15)
- [x] B2.4 Activer capacité livraison / stockage — `POST …/capabilities/{type}/activate` (configuration minimale, 409 sur second envoi, historique en ajout seul)
- [x] B2.5 Soumettre à vérification — `POST /agencies/{id}/submit` (propriétaire seul, 400 `SUBMISSION_INCOMPLETE` avec `missing`, 409 `AGENCY_ALREADY_SUBMITTED`, pas d'`If-Match`, identité verrouillée ensuite)
- [x] B2.6 Modifier le profil — `PATCH /agencies/{id}/profile` (brouillon ou soumise, `If-Match`)
- [x] B2.7 Suspendre une capacité — `POST …/capabilities/{type}/suspend` (motif 3–500, 409 sur second envoi)
- [x] B2.8 Gérer les sites — création, modification (`If-Match` sur la version du site), désactivation, réactivation, liste
- [x] B2.9 État d'onboarding — `GET /agencies/{id}/onboarding`, 404 uniforme hors membres actifs ; capacités, `hybrid`, zones et sites actifs réels depuis la tranche 3
- [x] B2.10 *(ajoutée le 2026-11-04, anomalie A-09)* Lister les membres d'une agence — `GET /agencies/{id}/members` (curseur, tout membre actif, sans e-mail : voir D-18)
- [x] B2.11 *(revue sécurité, à corriger)* `contactEmail` : validation Zod alignée sur B1 (`trim().email()`, `''` et `null` effacent) et défense du domaine (`p{Cc}`, `p{Cf}` refusés) ; NUL, BEL, U+202E : 400 au lieu de 500 ; `Email` partagé inchangé
- [x] B2.12 *(revue sécurité, à corriger)* audit des zones et sites : colonne `identity_audit.resource_id` (migration `1793785151369-audit-resource-id`), renseignée pour les 6 actions zone et site, `NULL` ailleurs
- [x] B2.14 *(ajoutée le 2026-11-04, D-20)* `GET /agencies/{id}` (identité complète) réservée au propriétaire et à l'administrateur : l'agent reçoit 403 (rôle lu dans la même requête que le filtre de membership) ; il garde l'état d'onboarding, les zones, les sites et la liste des membres ; 404 uniforme inchangé
- [x] B2.13 *(revue sécurité, durcissement — tranche 1 de B3)* agrégat `Agency` borné (300 zones au total, 50 sites actifs, 200 sites au total, 409 avec `code` — hypothèses, D-26) ; chargement complet conservé mais borné (nécessaire à la réactivation et aux doublons avec zones retirées) ; membership et rôle contrôlés avant `FOR UPDATE` (`lockTeamForActor`), puis re-contrôlés sous verrou (testé en E2E sur verrou réel) ; une seule définition `hasUnsafeCharacters` (`p{Cc}` sauf tab/LF/CR en multiligne, `p{Cf}`) pour tous les textes d'agence, nom commercial inclus (prérequis B3.9, A-38). Reste ouvert : données existantes contenant des `Cf` (D-26)
- [x] B2.15 *(contre-revue sécurité, durcissement, tranche 1 de B3)* droits en `Record<AgencyRole, boolean>` exhaustif (`managesAgencyIdentity`, `submitsAgency`, `canInvite`, `canManage`), test sur `AGENCY_ROLES` et rôle inconnu

### B3 — Tarifs, zones, marketplace publique (CRITIQUE)
Étapes : [x] S1 use cases (12 UC, 138 scénarios, 128 tests prévus ; `docs/use-cases/05-tarifs-zones/`, `docs/use-cases/03-marketplace-publique/` ; UC-05-01 et UC-05-03 complètent UC-02-03, D-15) · [x] S2 plan validé (2026-11-04, 5 tranches : 1) B2.13 + B2.15 + B3.2 ; 2) B3.4 + B3.5 + B3.14 + B3.6 + compléments B3.1, B3.3 ; 3) B3.7 + B3.8 + B3.15 ; 4) B3.9 ; 5) B3.10 à B3.13) · [~] S3–S8 (tranches 1 et 2 faites) · [ ] S9 (`security-reviewer` en fin de lot, tranche 1 comprise) · [ ] S10
- [x] B3.1 Créer zone — déjà livrée par B2.3 (D-15) ; complément B3 : zone sans ligne → `no_tariff` en simulation, sans erreur (E2E)
- [x] B3.2 Modifier zone — `PATCH /agencies/{id}/zones/{zoneId}` (module `agencies`, D-25 : même identifiant, dernière correction gagnante), événement `ServiceZoneRenamed` audité (`resource_id`, noms de champs), 409 `ZONE_ALREADY_SERVED` / `ZONE_RETIRED_DUPLICATE` / `ZONE_RETIRED`, concurrence testée en E2E, aucune migration
- [x] B3.3 Désactiver zone — retrait livré par B2.3 ; complément B3 : zone retirée non simulable ni versionnable (409 `ZONE_RETIRED`), lignes conservées et de nouveau valables à la réactivation (E2E)
- [x] B3.4 Créer grille tarifaire — `POST /agencies/{id}/rate-card` (module `pricing`, une grille par agence, `ON CONFLICT` : un 201 et des 409 en concurrence)
- [x] B3.5 Versionner grille — `POST /agencies/{id}/rate-card/versions` (`If-Match`, 428 / 409 `STALE_RATE_CARD_VERSION`, versions immuables, barème identique → 200 sans écriture)
- [x] B3.6 Simuler prix — `POST /agencies/{id}/quotes/preview` (entiers, poids taxable au gramme supérieur, volumétrique, `out_of_scale`, `no_tariff`)
- [ ] B3.7 Émettre devis
- [ ] B3.8 Accepter devis
- [ ] B3.9 Publier fiche publique (échapper la description à l'affichage, le HTML y est conservé comme texte depuis B2.6 ; refuser `p{Cf}` (bidi, largeur nulle) dans les noms publiables ; ne pas publier les agences au nom provisoire de migration ; publier les agences soumises avec la mention « non vérifiée » (D-05) ; propriétaire seul ; livrer B2.13 avant ou avec B3.9)
- [ ] B3.10 Rechercher (`GET /public/agencies`)
- [ ] B3.11 Filtrer zone / capacité
- [ ] B3.12 Consulter fiche (`/public/agencies/{slug}`)
- [ ] B3.13 Index, EXPLAIN, rate limit public
- [x] B3.14 *(ajoutée le 2026-11-04, anomalie A-35 des use cases)* Lire la grille et l'historique — `GET /agencies/{id}/rate-card`, `…/versions` (curseur, résumés), `…/versions/{number}`
- [ ] B3.15 *(ajoutée le 2026-11-04, anomalie A-35 des use cases)* Lister et consulter les devis de l'agence (tout membre actif, curseur)

### B4 — Clients, commerçants, demandes (CRITIQUE)
Étapes : [ ] S1 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6 · [ ] S7 · [ ] S8 · [ ] S9 · [ ] S10
- [ ] B4.1 Créer client
- [ ] B4.2 Modifier client
- [ ] B4.3 Fusionner doublons
- [ ] B4.4 Archiver client
- [ ] B4.5 Historique client
- [ ] B4.6 Lister / rechercher clients
- [ ] B4.7 Profil commerçant
- [ ] B4.8 Associer commerçant à plusieurs agences
- [ ] B4.9 Demander une prestation
- [ ] B4.10 Retirer sa demande
- [ ] B4.11 Lister les demandes
- [ ] B4.12 Accepter (idempotent, concurrence)
- [ ] B4.13 Refuser
- [ ] B4.14 Endpoints commerçant

### B5 — Commandes, colis, suivi (CRITIQUE)
Étapes : [ ] S1 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6 · [ ] S7 · [ ] S8 · [ ] S9 · [ ] S10
- [ ] B5.1 Créer commande manuelle
- [ ] B5.2 Commande issue d'une demande
- [ ] B5.3 Modifier avant prise en charge
- [ ] B5.4 Confirmer
- [ ] B5.5 Annuler sous conditions
- [ ] B5.6 Lister
- [ ] B5.7 Consulter
- [ ] B5.8 Rechercher
- [ ] B5.9 Historiser
- [ ] B5.10 Ajouter colis
- [ ] B5.11 Modifier colis avant scan
- [ ] B5.12 Recevoir
- [ ] B5.13 Scanner (idempotent)
- [ ] B5.14 Anomalie
- [ ] B5.15 Chronologie interne
- [ ] B5.16 Suivi public par jeton
- [ ] B5.17 Endpoints commerçant

### B6 — Livreurs, missions (CRITIQUE)
Étapes : [ ] S1 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6 · [ ] S7 · [ ] S8 · [ ] S9 · [ ] S10
- [ ] B6.1 Inviter livreur
- [ ] B6.2 Activer
- [ ] B6.3 Suspendre
- [ ] B6.4 Assigner zones
- [ ] B6.5 Disponibilité
- [ ] B6.6 Charge
- [ ] B6.7 Désactiver
- [ ] B6.8 Créer mission
- [ ] B6.9 Affecter
- [ ] B6.10 Réaffecter
- [ ] B6.11 Accepter
- [ ] B6.12 Démarrer
- [ ] B6.13 Tentative
- [ ] B6.14 Terminer
- [ ] B6.15 Preuve (upload)
- [ ] B6.16 Incident
- [ ] B6.17 Mes missions
- [ ] B6.18 Hors ligne idempotent

### B7 — Entrepôts, inventaire
Étapes : [ ] S1 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6 · [ ] S7 · [ ] S8 · [ ] S9 · [ ] S10
- [ ] B7.1 Créer entrepôt
- [ ] B7.2 Modifier
- [ ] B7.3 Archiver
- [ ] B7.4 Créer emplacement
- [ ] B7.5 Bloquer emplacement
- [ ] B7.6 Capacité
- [ ] B7.7 Mouvements
- [ ] B7.8 Avis de réception
- [ ] B7.9 Réceptionner
- [ ] B7.10 Quarantaine
- [ ] B7.11 Libérer quarantaine
- [ ] B7.12 Ajuster avec motif
- [ ] B7.13 Réserver (concurrence)
- [ ] B7.14 Libérer réservation
- [ ] B7.15 Inventorier
- [ ] B7.16 Consulter stock
- [ ] B7.17 Endpoints commerçant

### B8 — Préparation, transferts (CRITIQUE)
Étapes : [ ] S1 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6 · [ ] S7 · [ ] S8 · [ ] S9 · [ ] S10
- [ ] B8.1 Créer ordre de préparation
- [ ] B8.2 Réserver stock
- [ ] B8.3 Préparer
- [ ] B8.4 Confirmer picking
- [ ] B8.5 Emballer
- [ ] B8.6 Remettre au transporteur
- [ ] B8.7 Annuler
- [ ] B8.8 Demander transfert
- [ ] B8.9 Accepter (destination)
- [ ] B8.10 Préparer transfert
- [ ] B8.11 Expédier
- [ ] B8.12 Attester remise
- [ ] B8.13 Attester réception
- [ ] B8.14 Signaler écart
- [ ] B8.15 Clôturer
- [ ] B8.16 Accès inter-agences borné, tests anti-fuite

### B9 — Retours, réclamations (CRITIQUE)
Étapes : [ ] S1 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6 · [ ] S7 · [ ] S8 · [ ] S9 · [ ] S10
- [ ] B9.1 Signaler échec
- [ ] B9.2 Ouvrir retour
- [ ] B9.3 Autoriser
- [ ] B9.4 Suivre
- [ ] B9.5 Réceptionner retour
- [ ] B9.6 Ouvrir réclamation
- [ ] B9.7 Documenter
- [ ] B9.8 Clôturer

### B10 — Admin, rapports, durcissement (CRITIQUE)
Étapes : [ ] S1 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6 · [ ] S7 · [ ] S8 · [ ] S9 · [ ] S10
- [ ] B10.1 Rôle admin plateforme
- [ ] B10.2 Examiner agence
- [ ] B10.3 Demander justificatif
- [ ] B10.4 Approuver / rejeter
- [ ] B10.5 Suspendre
- [ ] B10.6 Restaurer
- [ ] B10.7 Modérer profil
- [ ] B10.8 Consulter audit
- [ ] B10.9 KPI agence
- [ ] B10.10 Volumes
- [ ] B10.11 Délais
- [ ] B10.12 Échecs
- [ ] B10.13 Occupation stock
- [ ] B10.14 Performance livreurs
- [ ] B10.15 Exports
- [ ] B10.16 Règles reporting
- [ ] B10.17 Mesures de performance
- [ ] B10.18 Revue sécurité, correlationId (inclut `lock_timeout` dans `migrate.ts`, index sur `identity_audit.resource_id` quand l'audit sera consulté en B10.8, et B0.12 R5 : ne journaliser d'un `QueryFailedError` que code, contrainte et `traceId`)
- [ ] B10.19 Rate limit partagé, RLS évaluée
- [ ] B10.20 Sauvegarde validée en cible
- [ ] B10.21 *(ajoutée le 2026-11-04)* Purge des `idempotency_keys` selon la rétention décidée (D-16)

---

## Frontend web

### F0 — Socle web
- [ ] F0.1 Outillage partagé
- [ ] F0.2 Types générés depuis l'OpenAPI
- [ ] F0.3 Client HTTP centralisé
- [!] F0.4 Stratégie de jetons web — décision D-02
- [ ] F0.5 Vitest, Testing Library, Playwright
- [ ] F0.6 Docker et CI front

### F1 — Back-office agence (Vite + RTK)
- [ ] F1.1 Connexion, session, profil
- [ ] F1.2 Sélecteur d'agence, gardes par rôle
- [ ] F1.3 Équipe
- [ ] F1.4 Onboarding
- [ ] F1.5 Zones, tarifs, devis
- [ ] F1.6 Fiche publique
- [ ] F1.7 Clients
- [ ] F1.8 Demandes reçues
- [ ] F1.9 Commandes
- [ ] F1.10 Colis
- [ ] F1.11 Livreurs
- [ ] F1.12 Dispatch
- [ ] F1.13 Entrepôts
- [ ] F1.14 Inventaire
- [ ] F1.15 Préparation
- [ ] F1.16 Transferts
- [ ] F1.17 Retours, réclamations
- [ ] F1.18 Dashboard, exports

### F2 — Front-office public (Next.js)
- [ ] F2.1 Pages publiques, SEO
- [ ] F2.2 Inscription, connexion, compte
- [ ] F2.3 Annuaire des agences
- [ ] F2.4 Fiche agence
- [ ] F2.5 Demandes de prestation
- [ ] F2.6 Espace commerçant web
- [ ] F2.7 Suivi public par jeton

### F3 — Admin plateforme (Vite + RTK)
- [ ] F3.1 Connexion admin plateforme
- [ ] F3.2 Vérification des agences
- [ ] F3.3 Suspension, restauration, modération
- [ ] F3.4 Audit
- [ ] F3.5 Statistiques plateforme

---

## Mobile (React Native + Expo)

### M0 — Socle mobile
- [!] M0.1 Organisation des applications — décision D-03
- [ ] M0.2 Expo, navigation, i18n, thème
- [ ] M0.3 Client API typé
- [ ] M0.4 Authentification, `expo-secure-store`
- [ ] M0.5 File d'actions hors ligne
- [ ] M0.6 Tests, build EAS, CI mobile

### M1 — App livreur
- [ ] M1.1 Connexion livreur
- [ ] M1.2 Mes missions
- [ ] M1.3 Accepter, démarrer
- [ ] M1.4 Détail mission
- [ ] M1.5 Tentative échouée
- [ ] M1.6 Terminer avec preuve
- [ ] M1.7 Incident
- [ ] M1.8 Disponibilité
- [ ] M1.9 Hors ligne et resynchronisation
- [ ] M1.10 Pas de GPS continu par défaut

### M2 — App commerçant
- [ ] M2.1 Connexion, profil commerçant
- [ ] M2.2 Agences, demandes
- [ ] M2.3 Commandes et suivi
- [ ] M2.4 Stock
- [ ] M2.5 Préparations, transferts
- [ ] M2.6 Retours, réclamations

---

## Décisions ouvertes

| ID | Sujet | Bloque | Statut |
|---|---|---|---|
| D-02 | Stockage des jetons côté web : BFF avec cookie `HttpOnly` ou cookie posé par l'API + CSRF | F0.4, F1.1, F2.2 | ouverte |
| D-03 | Mobile : deux applications ou une seule avec deux profils | M0.1 | ouverte (recommandé : deux) |
| D-06 | Acceptation automatique ou manuelle des demandes | B4 | ouverte |
| D-07 | Statuts et transitions des commandes et colis ; contenu et durée du suivi public | B5 | ouverte |
| D-08 | Preuves de livraison acceptées et conservation ; géolocalisation ; stockage des fichiers | B6, M1.6 | ouverte |
| D-09 | Responsabilité inter-agences, SLA, politique d'écart et de retours | B8, B9 | ouverte |
| D-10 | Responsables de validation et critères de certification des agences ; réexamen si le nom commercial change après approbation ; RCCM et NIU auto-déclarés | B10 | ouverte |
| D-11 | Rétention et calendrier des sauvegardes | B0.11, B10.20 | ouverte |
| D-21 | Quota de brouillons d'agence par utilisateur | B2.1, B10.19 | ouverte |
| D-18 | E-mail (ou libellé lisible) des membres pour l'écran équipe F1.3 : capacité de lecture exposée par `identity` (résolution par lot des `userId`) ? Donnée personnelle, périmètre critique | F1.3 | ouverte |
| D-16 | Rétention des clés d'idempotence (`idempotency_keys`) | B10.21 | ouverte |
| D-12 | Détecter une migration TypeORM modifiée après application (empreinte par migration) ; afficher ou non au migrateur le motif d'un refus d'adoption Drizzle (message sans donnée) | B10.18 | ouverte |
| D-26 | Plafonds de l'agence (hypothèses de B2.13 : 300 zones au total, 50 sites actifs, 200 sites au total) ; données existantes contenant des caractères désormais refusés (`p{Cf}`, `Cc` 0x80–0x9F) : la réhydratation échouerait — requête de détection avant déploiement, puis migration de nettoyage ou réhydratation tolérante | B10.18 (avant toute base de production) | ouverte (aucune base de production à ce jour) |
| D-27 | Historique des versions de grille : résumés dans la liste et barème complet par version (hypothèse appliquée) ou barème complet dans la liste | F1.5 | ouverte (défaut appliqué) |

Décisions prises :
- 2026-11-04 — **Plan B3 (S2)** validé : modules `pricing` (grille versionnée immuable, simulation, devis) et `marketplace` (fiche publique, annuaire) ; aucun accès aux tables d'`agencies` : un service de lecture exposé par `agencies` (rôle de l'appelant, zones actives, état de la livraison, données publiables), consommé derrière un port propre à chaque module, droits en `Record<AgencyRole, boolean>` exhaustif ; clé étrangère `(agency_id, zone_id)` vers `service_zones` (écart documenté : contrainte, pas lecture) ; projection `public_agency_listings` reconstruite par un subscriber in-process dans la transaction de l'action (`events.md` à amender) ; routes privées sous `/agencies/{id}/…` (anomalie A-37) ; curseur opaque pour la recherche publique ; B2.13 et B2.15 livrés en tranche 1.
- 2026-11-04 — **D-05 (barème)**, **D-22**, **D-23**, **D-24**, **D-25** : hypothèses par défaut des use cases B3 retenues.
  - D-05 : une grille de livraison par agence ; prix par tranches de poids (borne incluse) et par zone de destination, sans distance ni zone d'origine ; poids volumétrique facultatif (diviseur fixé par version, dimensions en cm) ; francs CFA entiers de 1 à 10 000 000, saisis taxes comprises, sans calcul de taxe ; poids taxable arrondi au gramme supérieur ; une nouvelle version s'applique immédiatement ; pas de tarif de stockage en B3.
  - D-22 : destinataire = nom + téléphone `+237` facultatif, privés à l'agence ; devis valable 7 jours ; prix manuel permis avec motif ; tout membre actif (agent compris) émet et enregistre l'acceptation au nom du client ; acceptation refusée si la zone est retirée ou la livraison suspendue ; aucune commande créée en B3 ; référence `DEV-AAAA-NNNNNN`.
  - D-23 : fiche publique = slug, nom, description, mention « non vérifiée », capacités, zones, villes des sites, tarifs « à partir de » ; raison sociale, contacts et identifiant interne restent privés ; slug stable jamais réattribué ; propriétaire seul publie ou retire ; au moins une capacité active (fiche masquée sinon) ; nom provisoire (« Agence » + 8 premiers caractères de l'identifiant) non publiable ; pas de simulation publique ; B2.13 livré avant ou avec B3.9.
  - D-24 : tri alphabétique, recherche sur le nom, filtre par ville incluant la ville des sites actifs, 60 requêtes par minute et par adresse.
  - D-25 : modifier une zone = corriger son libellé avec le même identifiant ; libellé refusé s'il égale une autre zone de l'agence (active ou retirée) ; la dernière correction concurrente l'emporte.
- 2026-11-04 — **D-05 (publication)** : une agence est publiable dans l'annuaire dès qu'elle est **soumise** et que son propriétaire publie sa fiche, avec une mention visible « non vérifiée » jusqu'à l'approbation par l'admin plateforme (B10) ; l'annuaire fonctionne dès B3. Barèmes, taxes et arrondi restent ouverts.
- 2026-11-04 — **D-20** : seuls le propriétaire et l'administrateur lisent l'identité complète de l'agence (`GET /agencies/{id}` : téléphone, e-mail, RCCM, NIU) ; l'agent reçoit 403 et garde l'état d'onboarding, les zones, les sites et la liste des membres (tâche B2.14).
- 2026-11-04 — **D-17** : configuration minimale absente à l'activation d'une capacité → 400 `CAPABILITY_PREREQUISITE_MISSING` avec `missing` (comme la soumission incomplète, 400 `SUBMISSION_INCOMPLETE`) ; seul le dernier motif de suspension est exposé.
- 2026-11-04 — **D-19** : toute agence doit avoir au moins un site actif pour être soumise, quelles que soient ses capacités (RG-02-05-02).
- 2026-11-04 — **Plan B2 (S2)** validé : agrégat unique `Agency` (identité, profil, capacités, zones, sites) sous le verrou de la ligne `agencies` ; droits via `AgencyTeam` ; création = agence + équipe dans une transaction (exception documentée) ; table `idempotency_keys` partagée ; version par `If-Match` ; routes d'action (`/identity`, `/profile`, `/capabilities/{type}/activate|suspend`, `/submit`) ; B2.10 inclus (liste des membres, tout membre actif). Questions mineures : défauts des use cases (pas d'abandon de brouillon, `AgencyRegistered` à la création, 100 zones actives max, motif de suspension 3–500 caractères, site sans GPS, pas d'audit des lectures).
- 2026-11-04 — **D-04** (hypothèses par défaut des use cases) : pour soumettre, raison sociale, ville et adresse du siège, téléphone `+237` + 9 chiffres (2 ou 6) ; e-mail, RCCM, NIU facultatifs ; aucun document en B2 (justificatifs en B10) ; livraison active = au moins une zone active, stockage actif = au moins un site actif ; après soumission, identité verrouillée, profil, zones, capacités et sites modifiables, pas de retrait ; statuts suivants (approuvée, rejetée, suspendue) décidés en B10.
- 2026-11-04 — **D-13** : propriétaire et administrateur configurent l'agence ; seul le propriétaire la soumet ; l'agent consulte.
- 2026-11-04 — **D-14** : `Idempotency-Key` facultative à la création d'agence (même clé et même contenu → même agence) ; soumettre, activer ou suspendre une seconde fois → 409, sans second effet.
- 2026-11-04 — **D-15** : la zone desservie déclarée à l'onboarding est la même zone que celle des grilles tarifaires de B3 (remplace l'hypothèse Q-07 des use cases).
- 2026-11-03 — **D-01** : TypeORM 0.3 sur PostgreSQL (écart assumé à l'ADR-02) et architecture normalisée des modules ; tests conservés sous `node:test`, colocalisés dans `src/**/tests/`. Voir [docs/architecture/adr-001-typeorm-et-architecture-normalisee.md](docs/architecture/adr-001-typeorm-et-architecture-normalisee.md).
- 2026-11-03 — Front-office en Next.js App Router ; back-office agence et admin plateforme en Vite + Redux Toolkit ; mobile en React Native + Expo.

---

## Journal (plus récent en haut)

| Date | Acteur | Tâche | Résultat | Commandes exécutées |
|---|---|---|---|---|
| 2026-11-04 | `back-builder` (mode light, rapport appliqué par la session principale) | B3 tranche 2 — B3.4 + B3.5 + B3.14 + B3.6 (+ compléments B3.1, B3.3) | Vert ; nouveau module `pricing` (6 routes), service de lecture `AgencyAccessReader` exposé par `agencies` (rôle, zones actives, livraison, `FOR SHARE` après contrôle du rôle) ; migration `1793808144018-rate-cards` (3 tables, clés étrangères composites dont `(agency_id, zone_id)` → `service_zones`, 5 CHECK) ; rouges constatés en unitaire et en E2E (module retiré → `404 !== 200`) ; écart TDD : `pricing-rights.ts` écrit avant son test ; concurrence testée (création, versionnement, publication contre retrait de zone) ; à reprendre en tranche 3 : import du domaine d'`agencies` par `pricing` (API publique à exposer), numéro de version logé dans `details.fields` de l'audit ; D-27 ouverte | `npm run lint` OK · `npm run typecheck` OK · `npm test` 320/320 (relancé par la session principale) · `npm run build` OK (relancé) · `migration:check` « No changes » · `npm audit --omit=dev` 0 · E2E Docker exit 0 · `compose down` |
| 2026-11-04 | `back-builder` (mode light, rapport appliqué par la session principale) | B3 tranche 1 — B2.15 + B2.13 + B3.2 | Vert ; rouges constatés en unitaire et en E2E (`404 !== 200` sur le code d'origine) ; aucune migration ; verrou réel testé (étranger, ancien membre, agent répondus sans attendre) ; service de lecture exposé reporté en tranche 2 avec son premier consommateur ; D-26 ouverte | `npm run lint` OK · `npm run typecheck` OK · `npm test` 254/254 (relancé par la session principale) · `npm run build` OK (relancé) · E2E Docker exit 0 · `npm audit --omit=dev` 0 · `migration:check` non lancé (aucun changement de schéma) |
| 2026-11-04 | user + session principale | B3.S2 — plan du lot validé | 5 tranches ; trois défauts retenus (découpage, projection publique in-process dans la transaction, routes sous `/agencies/{id}` et curseur opaque) ; tranche 1 lancée | aucune |
| 2026-11-04 | user + session principale | Décisions D-05 (barème), D-22, D-23, D-24, D-25 | Hypothèses par défaut des use cases B3 retenues ; B3.S2 (plan) lancé | aucune |
| 2026-11-04 | `use-case-writer` (mode light, rapport appliqué par la session principale) | B3.S1 — use cases tarifs, zones, marketplace publique | 12 UC (UC-05-01 et UC-05-03 en complément de UC-02-03, D-15), 138 scénarios (109 scénarios + 29 plans), 128 tests TDD prévus, 21 anomalies (A-18 à A-38), 28 questions (Q-20 à Q-47) ; couverture UC 12/12, RM 7/7 ; tâches B3.14 et B3.15 ajoutées (plan modifié, `phases.md` mis à jour) ; note B3.9 alignée sur D-05 (A-20) ; décisions D-22 à D-25 ouvertes ; en attente du user | aucune (documentation) |
| 2026-11-04 | user + session principale | D-05 (règle de publication) ; push de la branche | Agence soumise publiable avec la mention « non vérifiée » ; barèmes, taxes et arrondi encore ouverts | `git push` |
| 2026-11-04 | Claude (session principale) | B2.S10 — clôture du lot B2 | Lot B2 terminé : 13 tâches faites, durcissements B2.13 et B2.15 reportés ; critère de sortie (brouillon → soumise, validations, isolation entre agences) vérifié en E2E | `npm run lint` OK · `npm run typecheck` OK · `npm test` 220/220 · `npm run build` OK · `npm audit --omit=dev` 0 · `docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from test-api` exit 0 · `compose down` |
| 2026-11-04 | `security-reviewer` (mode light, rapport appliqué par la session principale) | B2.S9 — contre-revue des corrections B2.11, B2.12, B2.14 | C1, C2 et D-20 fermés ; aucun critique ni à corriger ; 3 durcissements (B2.15, caractères refusés unifiés → B2.13, `lock_timeout` → B10.18) | `git show 2411740 / 4d33a6a -- backend`, lecture du code ; schéma Zod exécuté sur 19 cas limites ; aucun test relancé |
| 2026-11-04 | `back-builder` (mode light, rapport appliqué par la session principale) | B2.14 — identité d'agence réservée au propriétaire et à l'administrateur (D-20) | Vert ; rouges constatés en unitaire (2 échecs sur 3) et en E2E (`200 !== 403`) ; aucune migration ; règle `managesAgencyIdentity` commune à la lecture et à l'édition | `npm run lint` OK · `npm run typecheck` OK · `npm test` 220/220 (relancé par la session principale) · `npm run build` OK · E2E Docker exit 0 · `npm audit --omit=dev` 0 |
| 2026-11-04 | user + session principale | Décision D-20 | Identité complète réservée au propriétaire et à l'administrateur ; tâche B2.14 ajoutée (plan modifié, `phases.md` mis à jour) | aucune |
| 2026-11-04 | `back-builder` (mode light, rapport appliqué par la session principale) | B2.11 + B2.12 — corrections de la revue sécurité | Vert ; rouges constatés en unitaire et en E2E (`500 !== 400`) ; migration `1793785151369-audit-resource-id` | `npm run lint` OK · `npm run typecheck` OK · `npm test` 219/219 (relancé par la session principale) · `npm run build` OK · `migration:check` « No changes » · E2E Docker exit 0 · `npm audit --omit=dev` 0 |
| 2026-11-04 | `security-reviewer` (mode light, rapport appliqué par la session principale) | B2.S9 — revue sécurité du lot B2 (`7a2cf3f`…`43e4f99`) | Aucun critique ; isolation, droits D-13, idempotence, concurrence, SQL et migrations jugés sains ; 2 à corriger (B2.11 `contactEmail` NUL → 500, B2.12 audit sans ressource) ; 6 durcissements (B2.13, notes B3.9, B10.18) ; D-20 et D-21 ouvertes | `git diff 8725e8b 43e4f99 -- backend`, lecture du code, des migrations et de `test/e2e.cjs` ; aucun test relancé |
| 2026-11-04 | user + session principale | Décisions D-17 et D-19 | Comportements implémentés confirmés (400 sur configuration minimale absente ; site actif exigé pour soumettre) ; aucun changement de code | aucune |
| 2026-11-04 | `back-builder` (mode light, rapport appliqué par la session principale) | B2 tranche 4 — B2.5 + B2.10 | Vert ; 2 routes (`submit`, `members`), aucune migration ; rouges constatés en unitaire et en E2E ; concurrence testée (double soumission, soumission contre édition d'identité) ; critère de sortie B2 vérifié en E2E (brouillon → soumise, validations, isolation) ; D-18 et D-19 ouvertes | `npm run lint` OK · `npm run typecheck` OK · `npm test` 217/217 (relancé par la session principale) · `npm run build` OK · `migration:check` « No changes » · E2E Docker exit 0 · `npm audit --omit=dev` 0 |
| 2026-11-04 | `back-builder` (mode light, rapport appliqué par la session principale) | B2 tranche 3 — B2.3 + B2.8 + B2.4 + B2.7 | Vert ; 10 routes (zones ×3, sites ×5, capacités ×2), état d'onboarding enrichi sans changement de contrat ; migration `1793783458220-agency-zones-sites-capabilities` (3 tables, index uniques partiels, 17 CHECK, clé de séquence des capacités) ; D-15 appliquée ; `DomainException` étendue (`code`, `missing`) ; rouges constatés en unitaire et en E2E ; concurrence testée (double activation, double suspension, doublons, dernière zone / dernier site) ; assertion d'audit de la tranche 2 rendue indépendante du gagnant d'une course ; D-17 ouverte | `npm run lint` OK · `npm run typecheck` OK · `npm test` 200/200 (relancé par la session principale) · `npm run build` OK · `migration:check` « No changes » · E2E Docker exit 0 · `npm audit --omit=dev` 0 |
| 2026-11-04 | `back-builder` (mode light, rapport appliqué par la session principale) | B2 tranche 2 — B2.2 + B2.6 | Vert ; 3 routes (`GET /agencies/{id}` ajoutée hors plan, `PATCH …/identity`, `PATCH …/profile`) ; migration `1793781805488-agency-identity-and-profile` (colonnes d'identité, 8 CHECK, `identity_audit.details` avec noms de champs uniquement) ; `If-Match` (428 absent, 400 mal formé, 409 périmé) ; rouges constatés en unitaire **et** en E2E (E2E écrite avant la présentation) ; `TradeName` refuse désormais les caractères de contrôle (NUL : 500 → 400) | `npm run lint` OK · `npm run typecheck` OK · `npm test` 128/128 (relancé par la session principale) · `npm run build` OK · `migration:check` « No changes » · E2E Docker exit 0 · `npm audit --omit=dev` 0 |
| 2026-11-04 | `back-builder` (mode light, rapport appliqué par la session principale) | B2 tranche 1 — B2.1 + B2.9 | Vert ; migration `1793777474207-agency-draft-and-idempotency` (colonnes d'agence, `idempotency_keys`, agences existantes nommées et rattachées à leur propriétaire) ; défaut latent de B0 corrigé : migrateur et `/health/ready` comparaient les migrations dans l'ordre de découverte des fichiers, pas par horodatage (`orderedMigrationNames`, test rouge puis vert) ; rouges constatés au niveau unitaire, pas en E2E ; tâche B10.21 et décision D-16 ajoutées | `npm run lint` OK · `npm run typecheck` OK · `npm test` 80/80 (relancé par la session principale) · `npm run build` OK · `migration:check` « No changes » (base migrée avec données et base neuve) · E2E Docker OK (concurrence de clé incluse) · `npm audit --omit=dev` 0 |
| 2026-11-04 | user + session principale | B2.S2 — plan du lot validé | 4 tranches ; trois propositions par défaut retenues (questions mineures, `If-Match`, B2.10 inclus) | aucune |
| 2026-11-04 | user + session principale | Décisions D-04, D-13, D-14, D-15 | Propositions par défaut retenues ; D-15 : zone desservie = zone tarifaire ; `phases.md` B2 mis à jour (plan modifié) | aucune |
| 2026-11-04 | `use-case-writer` (mode light, rapport appliqué par la session principale) | B2.S1 — use cases de l'onboarding agence | 9 UC (UC-02-09 ajouté), 111 scénarios Gherkin, 112 tests TDD prévus, 17 anomalies, 19 questions ; couverture UC 9/9, RM 4/4 ; tâche B2.10 ajoutée ; décisions D-13 à D-15 ouvertes ; en attente du user | aucune (documentation) |
| 2026-11-03 | `back-builder` (mode light, rapport appliqué par la session principale) | B0.12 — corrections R1 à R4 de la revue sécurité | Vert : R1 E2E (404 invitation autre agence, acceptation concurrente 200/404, un seul membership), R2 `open()` attend `initialize()`, R3 adoption Drizzle par empreintes et index uniques (adoptée / refusée sur PostgreSQL réel), R4 `invalidWhereValuesBehavior` ; R5 → B10.18, empreinte des migrations TypeORM → D-12 | `npm run lint` OK · `npm run typecheck` OK · `npm test` 58/58 (relancé par la session principale) · `npm run build` OK · E2E `compose.test.yaml` OK (1re exécution en échec sur une assertion de test, corrigée) · vérification R3 sur `postgres:16-alpine` temporaire · `npm audit --omit=dev` 0 |
| 2026-11-03 | `security-reviewer` (rapport appliqué par la session principale) | B0.12 — revue sécurité du commit `293a35b` | Aucun critique ; 1 à corriger (R1), 2 régressions du refactor (R2, R3), 2 durcissements (R4, R5) ; 2 constats antérieurs (B1.13, B1.14) | `git diff 5431052 293a35b`, lecture de `node_modules/typeorm`, `npm audit --omit=dev` (0) |
| 2026-11-03 | Claude (session principale) | Documentation de D-01 et B0.12 | `docs/README.md`, `docs/architecture/architecture-backend.md`, `docs/architecture/adr-001-typeorm-et-architecture-normalisee.md` ; `phases.md` et ce fichier alignés | aucune (documentation) |
| 2026-11-03 | Claude (session principale) | B0.12 — architecture normalisée + TypeORM (commit `293a35b`, mode light) | Vert ; contrat HTTP inchangé ; `CLAUDE.md`, agents et `backend/docs/` mis à jour ; revue sécurité lancée | `npm run lint` OK · `npm run typecheck` OK · `npm test` 49/49 · `npm run build` OK · `docker compose -f compose.test.yaml up --build …` E2E OK · `TEST_LEGACY=1 npm run test:e2e` OK · `typeorm migration:generate --check` « No changes » (base neuve et base Drizzle) · `npm audit --omit=dev` 0 vulnérabilité |
| 2026-11-03 | Claude (session principale) | Configuration Claude Code (commit `5431052`) | Agents, skills `core-*`, `CLAUDE.md`, cahier des charges dans `docs/cahier-des-charges/` | aucune (configuration) |
| 2026-11-03 | Claude (session principale) | Création de `progress.md` et `phases.md`, branchement dans `CLAUDE.md`, les agents et les skills de workflow | Fichiers créés ; état B0/B1 relevé depuis `backend/docs/` ; refactor TypeORM non commité signalé (D-01) | aucune commande de build ou de test (documentation uniquement) |
