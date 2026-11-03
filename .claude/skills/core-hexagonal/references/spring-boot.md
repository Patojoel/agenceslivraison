# Référence — Spring Boot (Java 21+)

## Arborescence d'un domaine

```
com.<org>.<app>.<domaine>/
├── domain/
│   ├── model/            # agrégats (extends AggregateRoot), entités internes
│   ├── vo/               # value objects propres au domaine (records)
│   ├── repositories/     # interfaces
│   ├── exceptions/
│   └── events/           # records DomainEvent / IntegrationEvent
├── application/
│   ├── command/<CasUsage>/   # <CasUsage>Command, <CasUsage>Handler, <CasUsage>Response
│   ├── queries/<CasUsage>/   # <CasUsage>QueryHandler, <CasUsage>Response, <Entity>DTO
│   ├── subscribers/          # On<Evenement><Reaction>Subscriber
│   └── ports/                # interfaces vers services tiers
└── infrastructure/
    ├── persistence/          # <Agg>Entity (@Entity), SpringData<Agg>Repository, Jpa<Agg>Repository (implémente l'interface domaine), <Agg>PersistenceMapper
    ├── adapters/<fournisseur>/  # implémentations des ports (RestClient)
    ├── configs/              # Config<CasUsage>Handler (@Bean) ou <Domaine>Config
    ├── scheduling/           # jobs @Scheduled (+ ShedLock si plusieurs instances)
    └── http/
        ├── interfaces/       # interface @RequestMapping + annotations OpenAPI
        ├── controllers/      # <CasUsage>Action implements l'interface
        ├── requests/         # records de requête validés (Bean Validation)
        └── factory/          # <CasUsage>CommandFactory : Request → Command
```

## Noyau partagé (`shared/`) à créer sur un projet neuf

| Fichier | Rôle |
| --- | --- |
| `domain/AggregateRoot.java` | collecte les événements (`registerEvent`, `pullEvents`) |
| `domain/DomainEvent.java`, `domain/IntegrationEvent.java` | interfaces marqueurs (`occurredAt`, clé de tenant) |
| `domain/vo/Id.java` et VO transverses | identifiants, montant, email, téléphone |
| `application/CommandHandler.java` | `interface CommandHandler<C, R> { R handle(C command); }` |
| `application/GenericResponse.java` | succès (`R`) ou erreur métier, retourné par le décorateur |
| `application/TransactionalException.java` | erreur système, jamais attrapée dans un handler |
| `infrastructure/TransactionalCommandHandlerFactory.java` | `create(handler)` → décorateur : transaction, publication des `DomainEvent` dans la transaction, `IntegrationEvent` après commit, conversion des exceptions |
| `infrastructure/events/DomainEventPublisher.java` | bus synchrone lié au thread |
| `infrastructure/events/Outbox…` | table outbox + relais post-commit (ou registre de publication Spring Modulith) |
| `infrastructure/http/GlobalExceptionHandler.java` | erreurs → format HTTP du projet (`ProblemDetail` RFC 7807 ou enveloppe maison) |
| `infrastructure/security/…` | configuration de sécurité, résolution de l'utilisateur et du tenant courants |

## Contrôleur type

```java
@RestController
public class PlaceOrderAction implements PlaceOrderApi {
    private final TransactionalCommandHandlerFactory handlerFactory;
    private final PlaceOrderHandler handler;

    @Override
    public ResponseEntity<PlaceOrderResponse> placeOrder(PlaceOrderRequest request) {
        var command = PlaceOrderCommandFactory.build(request);
        return handlerFactory.create(handler).handle(command).toResponseEntity();
    }
}
```

## Transactions et événements

- `@Transactional` uniquement dans le décorateur, jamais sur les handlers ni dans le domaine.
- `DomainEvent` publiés dans la transaction (subscribers synchrones).
- `IntegrationEvent` écrits dans l'outbox dans la même transaction, relayés après commit. Consommateurs idempotents.

## Persistance

- Entités JPA distinctes des agrégats ; mapping explicite dans un mapper.
- `spring.jpa.hibernate.ddl-auto=validate`. Schéma par Liquibase ou Flyway, un changeset numéroté par changement.
- JSON en `jsonb` via `@JdbcTypeCode(SqlTypes.JSON)`.
- Multi-tenant en schéma partagé : colonne de tenant indexée sur toutes les tables ; filtrage systématique (repository ou `@TenantId` Hibernate).

## Queries

`NamedParameterJdbcTemplate` + `MapSqlParameterSource`, records en sortie. Voir `core-sql-query`.

## Tests

| Niveau | Outils | Emplacement par défaut |
| --- | --- | --- |
| Unit | JUnit 5 + AssertJ, handler instancié à la main, repositories in-memory, builders | `src/test/java/.../<domaine>/unit/` |
| Feature | `@SpringBootTest`, vraie PostgreSQL (Testcontainers ou conteneur local), nettoyage de base entre tests | `.../<domaine>/feature/` |
| E2E | `@SpringBootTest` + MockMvc, vraie base, parcours HTTP complet | `.../<domaine>/e2e/` |

Si le projet co-localise ses tests ailleurs (par exemple `src/main/java/**/tests/`), reproduis l'existant. Pas de Mockito sur le domaine ni l'application : des fakes in-memory.

Commande ciblée : `./mvnw test -Dtest=NomDuTest` (ou la commande de la fiche projet).
