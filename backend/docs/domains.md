# Domaines et architecture

Le backend suit une architecture hexagonale avec CQRS, un module NestJS par domaine. Fichiers et dossiers en `kebab-case`, le rôle se lit dans le suffixe (`.handler.ts`, `.command.ts`, `.query.ts`, `.response.ts`, `.port.ts`, `.repository.ts`, `.orm-entity.ts`, `.mapper.ts`, `.request.ts`). Chaque module a la même organisation :

- `domain/` : agrégats (`session.ts`) et leur instantané (`session.snapshot.ts`), `value-objects/`, `exceptions/`, `events/`, et `ports/` pour les repositories d'écriture (interface + jeton `Symbol`). Ce dossier ne dépend ni de NestJS, ni de TypeORM, ni de Node.
- `application/` : `commands/<cas>/` (commande, handler, réponse), `queries/<cas>/` (query, handler), `read-models/`, `subscribers/` et `ports/` vers l'extérieur, dont les repositories de lecture (`read-*.repository.ts`), qui renvoient des read models et non des agrégats.
- `infrastructure/` : adaptateurs sortants — `persistence/typeorm/` (entités `*.orm-entity.ts`, mappers ORM ↔ agrégat, repositories `*.typeorm.repository.ts`), `crypto/`, `jwt/`.
- `presentation/http/` : adaptateurs entrants — contrôleurs, `dto/` (schémas Zod), `guards/`, `decorators/`.
- `tests/` : `doubles/` (implémentations in-memory des ports) et `unit/` (`*.spec.ts`).

Les dépendances vont toujours dans le sens `presentation / infrastructure → application → domain`. Un contrôleur valide l'entrée par `ZodValidationPipe`, construit la commande et appelle le handler enveloppé par `TransactionalCommandHandlerFactory` : toutes les requêtes SQL du handler, y compris l'audit, partagent alors une seule transaction. Les handlers sont `@Injectable()` et reçoivent leurs ports par `@Inject(<SYMBOL>)` ; les tests unitaires les instancient directement avec des doublures, sans NestJS.

Imports : alias `@shared/…`, `@modules/…`, `@config/…` entre modules, chemins relatifs à l'intérieur d'un module. `tsc-alias` les réécrit au build.

## Persistance

PostgreSQL via TypeORM. Les entités sont chargées par motif (`**/*.orm-entity.{ts,js}`) et portent les mêmes noms de contraintes, d'index et de clés étrangères que la base. Les migrations TypeORM vivent dans `src/migrations/` ; la première, `Baseline1793710789928`, reprend l'état final des migrations Drizzle 0001 à 0006 et adopte sans la recréer une base créée par une version précédente, après vérification des empreintes de l'historique Drizzle et des index uniques critiques (`shared/infrastructure/persistence/typeorm/drizzle-adoption.ts`). Après une modification d'entité : `npm run migration:generate -- src/migrations/<nom>` (base de développement migrée), relire le fichier, puis vérifier avec `npm run migration:check` qu'aucun écart ne subsiste. Les migrations restent une étape explicite (`npm run migrate`), jamais exécutée au démarrage.

La source de données est ouverte au premier usage (`TypeOrmDatabaseConnection`) et non au démarrage : l'API démarre et répond à la sonde de vivacité même si PostgreSQL est indisponible. Les verrous `FOR UPDATE` s'expriment par `lock: { mode: 'pessimistic_write' }`. Deux écritures restent en SQL paramétré : l'UPSERT des memberships, dont la clause `WHERE` empêche de rattacher un membership existant à une autre agence, et l'inscription d'une clé d'idempotence (`INSERT … ON CONFLICT DO NOTHING`), que le QueryBuilder ne sait pas exprimer.

## Noyau partagé — `src/shared/`

| Élément | Rôle |
| --- | --- |
| `AggregateRoot`, `DomainEvent`, `DomainException` | Bases du domaine. La catégorie d'une exception (`invalid`, `unauthorized`, `forbidden`, `not_found`, `conflict`) détermine le statut HTTP dans `ProblemDetailsFilter`. |
| `UserId`, `Email`, `TokenDigest`, `OpaqueToken` | Value objects communs aux deux modules. `OpaqueToken` a la forme `<uuid>.<secret>` : seul le condensat SHA-256 du secret est stocké. |
| `Clock`, `UuidGenerator` (`domain/ports/`) ; `TokenSecrets`, `AuditLog`, `DomainEventPublisher`, `IdempotencyKeys` (`application/ports/`) | Ports injectés dans les handlers, remplacés par des doublures in-memory dans les tests unitaires (`src/shared/tests/doubles/fakes.ts`). |
| `TypeOrmDatabaseConnection` | Ouverture paresseuse de la source de données ; transaction propagée par `AsyncLocalStorage` à tous les repositories appelés pendant `transaction()`. |
| `CursorPage`, `buildCursorPage` | Contrat des listes : `{ items, nextCursor, hasMore }`, pagination par clé, jamais par décalage. |
| `IdempotencyKeys` (adaptateur `TypeOrmIdempotencyKeys`, table `idempotency_keys`) | Rejeu d'une création : la clé est inscrite dans la transaction par `INSERT … ON CONFLICT DO NOTHING` ; un second appel simultané attend la première transaction puis lit son résultat. Même clé et même contenu (condensat SHA-256) : même ressource ; autre contenu : conflit. Clé propre à l'acteur et à l'opération (`scope`). Aucune purge pour l'instant. |
| `ZodValidationPipe`, `@IdempotencyKey()`, `ProblemDetailsFilter`, `HealthController` (`presentation/`) | Validation des entrées (400 sans détail), erreurs RFC 9457, sondes `live` / `ready`. |
| `ServiceUnavailableError` | Dépendance indisponible (clé de signature absente…) : réponse 503. |
| `src/config/` | Variables d'environnement validées par Zod au démarrage (`env.schema.ts`), options TypeORM de l'application et du CLI. |

## Identité — `src/modules/identity/`

Comptes, identifiants et sessions. Ce module expose aux autres modules `AccessTokenGuard` et `@CurrentUser()`, qui authentifient le porteur d'un jeton d'accès dont la session est encore ouverte.

| Agrégat | Invariants |
| --- | --- |
| `User` | E-mail normalisé et unique ; mot de passe de 12 à 128 caractères et d'au plus 256 octets, stocké uniquement haché (Argon2id). |
| `Session` | Durée de 30 jours à partir de l'ouverture ou du dernier renouvellement. Le renouvellement exige le secret courant et le remplace : un jeton ne sert qu'une fois. La révocation est définitive et reste possible après expiration. |

- **Commandes** : `register-user`, `login`, `refresh-session`, `logout`.
- **Query** : `authenticate` (port de lecture `ReadSessionRepository`).
- **Ports** : `PasswordHasher`, `AccessTokens`.

## Agences — `src/modules/agencies/`

Agence (brouillon d'onboarding), équipe et invitations. Onboarding : la création et la consultation de l'état sont livrées (B2.1, B2.9) ; l'identité, les capacités, les zones, les sites et la soumission arrivent dans les tranches suivantes de B2.

| Agrégat | Invariants |
| --- | --- |
| `Agency` | Naît toujours au statut `draft` (`draft` ou `submitted`, seule la création est livrée), version 1, avec son créateur et sa date. Le nom commercial (`TradeName`) est débarrassé de ses espaces de bord et compte de 2 à 120 caractères (comptés comme `char_length` de PostgreSQL). La création émet `AgencyRegistered`. Les colonnes d'identité (raison sociale, ville, adresse du siège, téléphone principal) et de soumission existent déjà mais ne sont pas encore écrites. |
| `AgencyTeam` | Contient l'agence et tous ses memberships, actifs ou non. Il est chargé sous le verrou `FOR UPDATE` de la ligne `agencies`, ce qui sérialise toutes les modifications d'une même équipe. Personne ne gère son propre accès. Un propriétaire gère tout le monde ; un administrateur gère uniquement des agents, et seulement en tant qu'agents. Un agent ne gère personne. L'agence garde au moins un propriétaire actif. Un ancien membre, même désactivé, ne peut pas être réadmis par invitation. |
| `Invitation` | Valable 7 jours, à usage unique, réservée à l'adresse invitée. Seuls des rôles `admin` ou `agent` peuvent être attribués par invitation. Un jeton inconnu, expiré, déjà utilisé ou adressé à quelqu'un d'autre produit la même erreur 404. |

- **Commandes** : `create-agency`, `change-member-role`, `revoke-membership`, `issue-invitation`, `accept-invitation`.
- **Queries** : `list-my-agencies` (port de lecture `ReadAgencyMembershipRepository`), `get-agency-onboarding` (port `ReadAgencyOnboardingRepository`).

Les prérequis de soumission (`legal_name`, `headquarters_city`, `headquarters_address`, `primary_phone`, `active_capability`, `active_site`, décision D-04) sont définis une seule fois dans `domain/onboarding-requirements.ts` (`evaluateOnboarding`) : l'état d'onboarding les affiche, la future soumission les exigera. L'état ne contient jamais les valeurs de l'identité, seulement « rempli ou non ». Tant que les tranches suivantes ne sont pas livrées, les capacités, zones et sites actifs sont vides ou nuls.

Un acteur qui n'est pas membre actif de l'agence reçoit 404 et non 403, pour ne pas révéler l'existence de l'agence.

### Exception assumée : création d'une agence

`create-agency` écrit deux agrégats dans une même transaction : l'`Agency` (brouillon) et l'`AgencyTeam` fondée par `AgencyTeam.found`, qui porte le membership `owner` actif du créateur. Une agence sans propriétaire serait ingérable (personne ne pourrait inviter ni gérer l'équipe) : l'une n'existe pas sans l'autre, et l'échec de l'une annule tout. L'audit (`agency.created`) est écrit dans la même transaction. Avec une `Idempotency-Key`, la clé est inscrite avant les écritures : un rejeu renvoie l'agence d'origine sans rien écrire.

### Exception assumée : acceptation d'une invitation

`accept-invitation` modifie deux agrégats dans une même transaction : l'`Invitation`, marquée acceptée, et l'`AgencyTeam`, qui reçoit le nouveau membership. Le contrat HTTP l'impose : une personne déjà membre doit recevoir un 409 immédiat et l'invitation doit rester utilisable. Une cohérence par événement après commit casserait ces deux garanties. Les verrous sont toujours pris dans le même ordre : l'invitation, puis l'agence.
