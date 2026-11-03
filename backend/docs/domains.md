# Domaines et architecture

Le backend suit une architecture hexagonale avec CQRS, un module NestJS par domaine. Chaque module a la même organisation :

- `domain/` : agrégats, value objects, exceptions métier, événements, interfaces de repository. Ce dossier ne dépend ni de NestJS, ni de `pg`, ni de Node.
- `application/` : un dossier par commande (commande, handler et réponse), les queries, les subscribers et les ports vers l'extérieur.
- `infrastructure/` : repositories PostgreSQL, adapters (argon2, JWT), contrôleurs HTTP et schémas Zod.

Les dépendances vont toujours dans le sens `infrastructure → application → domain`. Un contrôleur valide l'entrée, construit la commande et appelle le handler enveloppé par `TransactionalCommandHandlerFactory` : toutes les requêtes SQL du handler, y compris l'audit, partagent alors une seule transaction. Les handlers sont câblés explicitement par `useFactory` dans le module ; leurs classes ne portent aucun décorateur NestJS.

Le schéma Drizzle reste centralisé dans `src/schema/` et sert de source aux migrations ; les repositories utilisent du SQL paramétré avec `pg`.

## Noyau partagé — `src/shared/`

| Élément | Rôle |
| --- | --- |
| `AggregateRoot`, `DomainEvent`, `DomainException` | Bases du domaine. La catégorie d'une exception (`invalid`, `unauthorized`, `forbidden`, `not_found`, `conflict`) détermine le statut HTTP dans `ProblemDetailsFilter`. |
| `UserId`, `Email`, `TokenDigest`, `OpaqueToken` | Value objects communs aux deux modules. `OpaqueToken` a la forme `<uuid>.<secret>` : seul le condensat SHA-256 du secret est stocké. |
| `Clock`, `IdGenerator`, `TokenSecrets`, `AuditLog`, `DomainEventPublisher`, `SqlReader` | Ports injectés dans les handlers, remplacés par des doublures in-memory dans les tests unitaires (`test/support/fakes.ts`). |
| `Database` | Transaction propagée par `AsyncLocalStorage`, implémente `SqlReader`. |
| `ServiceUnavailableError` | Dépendance indisponible (clé de signature absente…) : réponse 503. |

## Identité — `src/modules/identity/`

Comptes, identifiants et sessions. Ce module expose aux autres modules `AccessTokenGuard` et `@CurrentUser()`, qui authentifient le porteur d'un jeton d'accès dont la session est encore ouverte.

| Agrégat | Invariants |
| --- | --- |
| `User` | E-mail normalisé et unique ; mot de passe de 12 à 128 caractères et d'au plus 256 octets, stocké uniquement haché (Argon2id). |
| `Session` | Durée de 30 jours à partir de l'ouverture ou du dernier renouvellement. Le renouvellement exige le secret courant et le remplace : un jeton ne sert qu'une fois. La révocation est définitive et reste possible après expiration. |

- **Commandes** : `register-user`, `login`, `refresh-session`, `logout`.
- **Query** : `authenticate`.
- **Ports** : `PasswordHasher`, `AccessTokens`.

## Agences — `src/modules/agencies/`

Équipe d'une agence et invitations. La création d'agence (onboarding) n'est pas encore implémentée.

| Agrégat | Invariants |
| --- | --- |
| `AgencyTeam` | Contient l'agence et tous ses memberships, actifs ou non. Il est chargé sous le verrou `FOR UPDATE` de la ligne `agencies`, ce qui sérialise toutes les modifications d'une même équipe. Personne ne gère son propre accès. Un propriétaire gère tout le monde ; un administrateur gère uniquement des agents, et seulement en tant qu'agents. Un agent ne gère personne. L'agence garde au moins un propriétaire actif. Un ancien membre, même désactivé, ne peut pas être réadmis par invitation. |
| `Invitation` | Valable 7 jours, à usage unique, réservée à l'adresse invitée. Seuls des rôles `admin` ou `agent` peuvent être attribués par invitation. Un jeton inconnu, expiré, déjà utilisé ou adressé à quelqu'un d'autre produit la même erreur 404. |

- **Commandes** : `change-member-role`, `revoke-membership`, `issue-invitation`, `accept-invitation`.
- **Query** : `list-my-agencies`.

Un acteur qui n'est pas membre actif de l'agence reçoit 404 et non 403, pour ne pas révéler l'existence de l'agence.

### Exception assumée : acceptation d'une invitation

`accept-invitation` modifie deux agrégats dans une même transaction : l'`Invitation`, marquée acceptée, et l'`AgencyTeam`, qui reçoit le nouveau membership. Le contrat HTTP l'impose : une personne déjà membre doit recevoir un 409 immédiat et l'invitation doit rester utilisable. Une cohérence par événement après commit casserait ces deux garanties. Les verrous sont toujours pris dans le même ordre : l'invitation, puis l'agence.
