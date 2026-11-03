# Architecture du backend — NestJS + hexagonal + DDD + CQRS

Référence de structure pour tout module de `backend/`. Elle applique l'architecture normalisée fournie par le commanditaire, adaptée aux exigences du cahier des charges ([ADR-001](adr-001-typeorm-et-architecture-normalisee.md)). L'état des modules existants, leurs agrégats et leurs invariants sont dans [backend/docs/domains.md](../../backend/docs/domains.md).

## 1. Conventions

| Règle | Choix |
|---|---|
| Dossiers et fichiers | `kebab-case` intégral |
| Suffixes | `.command.ts`, `.query.ts`, `.handler.ts`, `.response.ts`, `.snapshot.ts`, `.port.ts`, `.repository.ts`, `.read-model.ts`, `.orm-entity.ts`, `.mapper.ts`, `.request.ts`, `.spec.ts` |
| Adaptateurs entrants | `presentation/` (HTTP aujourd'hui) |
| Adaptateurs sortants | `infrastructure/` (persistance, crypto, JWT, horloge, UUID) |
| Jetons d'injection | `Symbol` exporté à côté de l'interface du port |
| Exports | nommés uniquement |
| Imports | `@shared/…`, `@modules/…`, `@config/…` entre modules ; relatifs à l'intérieur d'un module. `tsc-alias` les réécrit au build |
| TypeScript | `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` |

## 2. Arborescence

```text
backend/
├── tsconfig.json            # alias + options strictes (sources et tests)
├── tsconfig.build.json      # exclut src/**/tests/**
├── test/e2e.cjs             # HTTP + PostgreSQL réel, base dédiée et vide
└── src/
    ├── main.ts, app.module.ts, migrate.ts
    ├── config/              # env.schema.ts (Zod), typeorm.config.ts, typeorm-cli.config.ts
    ├── migrations/          # migrations TypeORM, forward-only
    ├── shared/
    │   ├── domain/          # aggregate-root, domain-event, exceptions/, ports/ (clock, uuid-generator), value-objects/
    │   ├── application/     # command-handler, errors/, pagination/ (cursor-page), ports/ (audit-log, domain-event-publisher, token-secrets)
    │   ├── infrastructure/  # persistence/typeorm/, clock/, uuid/, crypto/, events/, shared-infrastructure.module.ts
    │   ├── presentation/    # filters/ (problem-details), pipes/ (zod-validation), health/, middleware/ (readiness)
    │   └── tests/           # doubles/, unit/
    └── modules/<module>/
        ├── <module>.module.ts
        ├── domain/          # <agrégat>.ts, <agrégat>.snapshot.ts, value-objects/, exceptions/, events/, ports/<agrégat>.repository.ts
        ├── application/
        │   ├── commands/<cas>/   # <cas>.command.ts, <cas>.handler.ts, <cas>.response.ts
        │   ├── queries/<cas>/    # <cas>.query.ts, <cas>.handler.ts, <cas>.response.ts
        │   ├── read-models/      # projections renvoyées par les lectures
        │   ├── ports/            # read-<x>.repository.ts, ports vers des services tiers
        │   └── subscribers/
        ├── infrastructure/
        │   └── persistence/typeorm/  # <x>.orm-entity.ts, <x>.mapper.ts, <x>.typeorm.repository.ts, read-<x>.typeorm.repository.ts
        ├── presentation/http/        # <ressource>.controller.ts, dto/<cas>.request.ts, guards/, decorators/
        └── tests/                    # doubles/ (in-memory), unit/ (*.spec.ts)
```

## 3. Règles de structure

1. **Domaine pur** : `domain/` n'importe ni NestJS, ni TypeORM, ni Zod, ni Node. L'agrégat se crée par une fabrique qui valide (`Session.open`, `Invitation.issue`) et se réhydrate par `reconstitute` sans rejouer les règles.
2. **Port d'écriture dans le domaine, port de lecture dans l'application** : le repository d'écriture protège des invariants et manipule des agrégats ; le repository de lecture renvoie des read models et peut court-circuiter le domaine.
3. **Les erreurs métier remontent** : un handler ne transforme jamais une `DomainException` en booléen ; `ProblemDetailsFilter` la traduit en statut HTTP selon sa catégorie.
4. **Identifiants générés côté serveur** par le port `UuidGenerator`, jamais acceptés depuis la requête.
5. **Handlers** `@Injectable()`, dépendances par `@Inject(<SYMBOL>)`, appelés par le contrôleur via `TransactionalCommandHandlerFactory`. Les tests unitaires les instancient directement avec des doublures in-memory, sans `Test.createTestingModule` ni bibliothèque de mock.
6. **Persistance** : entités et mappers ne sortent jamais de `infrastructure/`. Les repositories prennent l'`EntityManager` par `TypeOrmDatabaseConnection.manager()`.
7. **Contrôleur fin** : `ZodValidationPipe` sur le corps, les paramètres et la query string, commande construite depuis `@CurrentUser()`, aucune règle métier.

## 4. Écarts assumés avec l'exemple de référence

| Exemple de référence | Retenu ici | Raison |
|---|---|---|
| TypeORM sur MySQL | TypeORM sur PostgreSQL 16 | PostgreSQL imposé par le cahier des charges |
| `@InjectRepository` dans les repositories | `TypeOrmDatabaseConnection.manager()` | rester dans la transaction de la commande (`AsyncLocalStorage`) |
| Initialisation de TypeORM au démarrage, `migrationsRun` hors production | ouverture au premier usage, migration explicite `npm run migrate` | sonde `live` sans base ; API en 503 tant que la migration n'a pas tourné |
| Jest + `ts-jest`, `jest-e2e.json` | `node:test` + `tsx`, `test/e2e.cjs` | outillage existant, choix du commanditaire |
| `class-validator` dans `dto/` | schémas Zod `.strict()` + `ZodValidationPipe` | validation stricte déjà en place, schémas réutilisables |
| Réponse d'erreur `{ statusCode, code, message }` | Problem Details RFC 9457 | exigé par le cahier des charges et déjà consommé par les clients |
| Pagination `page` / `perPage` / `total` | `{ items, nextCursor, hasMore }` (`CursorPage`) | pagination stable par curseur exigée |
| `moduleResolution: nodenext` | `commonjs` / `node` | compatibilité de l'outillage actuel (NestJS 11, `tsx`, `tsc-alias`) |
| Un contrôleur par ressource | `AuthController` regroupe inscription, connexion, rafraîchissement et déconnexion ; `operationId` d'origine conservés | clients OpenAPI générés inchangés |

## 5. Ajouter un module

1. Rédiger les use cases (`use-case-writer`) et faire valider le plan.
2. Créer l'arborescence de la section 2, en partant du module `agencies` comme modèle.
3. TDD : domaine, puis handlers avec doublures in-memory dans `tests/doubles/`.
4. Entité `*.orm-entity.ts` avec des noms de contraintes explicites et `agency_id NOT NULL` pour toute donnée d'agence ; `npm run migration:generate -- src/migrations/<nom>` sur une base de développement migrée ; relire ; `npm run migration:check`.
5. Contrôleur, DTO Zod, câblage du module, import dans `AppModule`.
6. Étendre `test/e2e.cjs` : 200/201, 400, 401, 403, 404 sur une autre agence, 409, pagination.
7. Mettre à jour `backend/docs/domains.md`, `backend/docs/routes/`, `progress.md`.
