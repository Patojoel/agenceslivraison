# Référence — NestJS (TypeScript strict)

## Arborescence d'un domaine

```
src/modules/<domaine>/
├── domain/
│   ├── model/             # agrégats (extends AggregateRoot), entités internes
│   ├── vo/
│   ├── repositories/      # interfaces + jetons d'injection (Symbol)
│   ├── exceptions/
│   └── events/
├── application/
│   ├── command/<cas-usage>/   # <cas-usage>.command.ts, .handler.ts, .response.ts
│   ├── queries/<cas-usage>/   # .query-handler.ts, .response.ts, .dto.ts
│   ├── subscribers/
│   └── ports/                 # interfaces + jetons vers services tiers
├── infrastructure/
│   ├── persistence/           # schéma Drizzle de la table, Drizzle<Agg>Repository, mapper
│   ├── adapters/<fournisseur>/
│   ├── http/                  # <cas-usage>.controller.ts, requests (schémas Zod ou class-validator), factory Request → Command
│   └── jobs/                  # workers BullMQ, crons
└── <domaine>.module.ts        # providers : { provide: ORDER_REPOSITORY, useClass: DrizzleOrderRepository }, handlers
```

## Noyau partagé (`src/shared/`)

| Fichier | Rôle |
| --- | --- |
| `domain/aggregate-root.ts` | collecte des événements |
| `domain/domain-event.ts`, `integration-event.ts` | contrats |
| `application/command-handler.ts` | `interface CommandHandler<C, R> { handle(command: C): Promise<R> }` |
| `infrastructure/transactional-command-handler.factory.ts` | décorateur : `db.transaction`, propagation de la transaction par `AsyncLocalStorage`, publication des événements |
| `infrastructure/events/outbox.*` | table outbox + relais vers BullMQ après commit |
| `infrastructure/http/domain-exception.filter.ts` | exceptions métier → statuts HTTP et format d'erreur du projet |
| `infrastructure/db/drizzle.provider.ts` | client Drizzle + accès à la transaction courante |
| `infrastructure/security/` | guards d'authentification, résolution de l'utilisateur et du tenant |

## Règles propres à NestJS

- Les ports sont injectés par **jeton** (`@Inject(ORDER_REPOSITORY)`), jamais par classe concrète.
- Les décorateurs NestJS (`@Injectable`, `@Inject`) restent dans `application/` (handlers) et `infrastructure/` ; jamais dans `domain/`.
- Le contrôleur valide l'entrée (pipe Zod ou `ValidationPipe`), construit la commande, appelle `factory.create(handler).handle(command)`.
- Si le projet utilise `@nestjs/cqrs`, garde son `CommandBus` mais conserve le décorateur transactionnel et les fakes in-memory.
- Files de messages : BullMQ + Redis. Chaque job est idempotent (clé de déduplication).

## Persistance

- ORM : Drizzle par défaut ; migrations `drizzle-kit` versionnées.
- Les objets Drizzle ne sortent jamais de `infrastructure/persistence/`.

## Queries

`` db.execute(sql`... WHERE tenant_id = ${tenantId}`) `` : le template `sql` paramètre les valeurs. Jamais de concaténation de chaîne. DTO `readonly` en sortie. Voir `core-sql-query`.

## Tests

| Niveau | Outils |
| --- | --- |
| Unit | Vitest (ou Jest selon le projet), handler instancié à la main, repositories in-memory |
| Feature | Vitest + PostgreSQL réelle (Testcontainers ou conteneur local), nettoyage entre tests |
| E2E | `Test.createTestingModule` + Supertest sur l'application complète |
