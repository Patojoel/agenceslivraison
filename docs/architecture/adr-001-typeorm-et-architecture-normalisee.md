# ADR-001 — TypeORM et architecture normalisée du backend

| Champ | Valeur |
|---|---|
| Date | 2026-11-03 |
| Statut | Accepté (décision D-01 de `progress.md`) |
| Décideur | Commanditaire du projet |
| Remplace | ADR-02 du cahier des charges (« PostgreSQL + Drizzle », statut RECOMMANDÉ) pour la partie ORM |
| Mise en œuvre | Commit `293a35b`, branche `refactor/architecture-normalisee` |

## Contexte

Le backend (lots B0 et B1 livrés) utilisait Drizzle pour le schéma et les migrations, et des requêtes SQL `pg` écrites à la main dans les repositories. Le commanditaire a fourni une architecture de référence NestJS + hexagonal + DDD + CQRS (conventions de nommage, couche `presentation/`, ports à côté de leur jeton, tests colocalisés, alias de chemins) et a demandé de l'appliquer, en retenant TypeORM pour la persistance.

Le cahier des charges marque l'ADR-02 (Drizzle) comme RECOMMANDÉ, c'est-à-dire modifiable après audit, et non CONFIRMÉ.

## Décision

1. **Persistance** : TypeORM 0.3 sur PostgreSQL 16 (pas de MySQL : PostgreSQL reste imposé par le cahier des charges). Migrations TypeORM dans `backend/src/migrations/`.
2. **Architecture** : l'arborescence et les conventions décrites dans [architecture-backend.md](architecture-backend.md) s'appliquent à tous les modules.
3. **Tests** : `node:test` + `tsx` est conservé (pas de Jest), avec des specs colocalisées dans chaque module.
4. **Contrat HTTP inchangé** : routes, corps, statuts, Problem Details (RFC 9457), pagination par curseur et `operationId` OpenAPI restent identiques.

## Options écartées

| Option | Raison |
|---|---|
| Garder Drizzle et n'appliquer que la structure | Recommandée initialement ; écartée par le commanditaire. |
| Passer aussi à MySQL comme dans l'exemple de référence | PostgreSQL est imposé par le cahier des charges (verrous, `unnest`, contraintes `CHECK`, futur RLS). |
| Migrer les tests vers Jest | Aucune valeur ajoutée pour le coût : réécriture de toutes les assertions, nouvelle dépendance. |
| `migrationsRun` au démarrage (exemple de référence) | Interdit par le cahier des charges : la migration est une étape explicite, et l'API doit rester en 503 tant qu'elle n'a pas tourné. |

## Conséquences

- **Base existante** : la migration `Baseline1793710789928` reprend l'état final des migrations Drizzle 0001 à 0006. Sur une base créée par une version Drizzle complète, elle est enregistrée sans rejouer le DDL : aucune donnée perdue, aucune recréation de volume. Un historique Drizzle incomplet est refusé.
- **Schéma figé par les entités** : les entités portent les noms exacts des clés primaires, index, contraintes `CHECK` et clés étrangères. `npm run migration:check` doit toujours répondre « No changes in database schema were found ».
- **Transactions** : les repositories obtiennent l'`EntityManager` de la transaction courante via `TypeOrmDatabaseConnection.manager()`. `@InjectRepository`, utilisé dans l'exemple de référence, est proscrit : il ferait sortir les écritures de la transaction de la commande.
- **Démarrage sans base** : la source de données est ouverte au premier usage (`manualInitialization`), pour que la sonde `/health/live` réponde même si PostgreSQL est arrêté.
- **SQL brut résiduel** : l'UPSERT des memberships reste en SQL paramétré, car sa clause `WHERE` empêche de rattacher un membership à une autre agence, ce que l'upsert TypeORM ne sait pas exprimer.
- **Dépendances** : `typeorm`, `@nestjs/typeorm`, `@nestjs/config`, `tsc-alias` ajoutés ; `drizzle-orm`, `drizzle-kit` retirés ; `glob` forcé en 14.x (`overrides`) pour supprimer les alertes `npm audit` amenées par `typeorm` 0.3.
- **Documentation alignée** : `CLAUDE.md` (fiche projet), agents `back-builder`, `archi-reviewer`, `query-perf`, `phases.md` (S4, S5, B0), `backend/docs/domains.md`, `backend/README.md`, `backend/docs/operations/exploitation.md`.

## Vérification

Exécutée le 2026-11-03 : lint, typecheck, 49 tests unitaires, build, E2E Docker (également avec `TEST_LEGACY=1`), `migration:check` sans écart sur une base neuve et sur une base reconstruite à partir des fichiers Drizzle d'origine, refus d'un historique Drizzle partiel, `npm audit --omit=dev` sans vulnérabilité. Revue `security-reviewer` du même jour : aucune faille critique ; isolation entre agences, verrous `FOR UPDATE`, authentification et secrets jugés équivalents à la version Drizzle. Points ouverts, suivis dans `progress.md` (B0.12, R1 à R5) : deux tests E2E manquants, une course à la première ouverture de la source de données, une adoption de base Drizzle qui compte les migrations au lieu de comparer leurs empreintes, l'option `invalidWhereValuesBehavior` à durcir.
