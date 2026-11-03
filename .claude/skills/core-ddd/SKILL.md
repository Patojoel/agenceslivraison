---
name: core-ddd
description: Conventions DDD (Domain-Driven Design) génériques pour tous les projets backend (Spring Boot, NestJS, Laravel, FastAPI) — domaines bornés, agrégats, value objects, interfaces de repository, exceptions métier, événements de domaine et d'intégration, langage ubiquitaire, invariant multi-tenant. Charge ce skill avant d'écrire ou de modifier du code de domaine, avant de découper un nouveau domaine, de créer un agrégat ou un value object, ou de décider si deux concepts doivent communiquer par événement. Se combine avec core-hexagonal et core-tdd.
---

# DDD — Domain-Driven Design

**Priorité** : `CLAUDE.md` et `docs/` du projet (notamment `docs/domains.md`, `docs/events.md`, le glossaire et le cahier des charges) priment sur ce skill. Lis-les avant d'écrire du domaine. La section « Fiche projet » de `CLAUDE.md` donne la **clé de tenant** (par exemple `schoolId`, `tenantId`, `organizationId`) et la langue du code.

## Principes

1. **Domaines bornés** — un package ou module par domaine. La liste à jour vit dans `docs/domains.md`. Un concept ne fuit pas d'un domaine à l'autre autrement que par un **événement** ou une interface explicitement exposée par le domaine propriétaire.
2. **Le domaine ne dépend de rien** — la couche `domain/` ne connaît ni le framework (Spring, NestJS, Laravel, FastAPI), ni l'ORM, ni HTTP, ni la messagerie. Aucune annotation d'injection ou de persistance. Les dépendances externes entrent par des **interfaces** déclarées dans le domaine (repositories) ou dans l'application (ports vers des services tiers).
3. **Agrégats** — héritent de la classe de base du projet (`AggregateRoot` ou équivalent) qui collecte les événements. État encapsulé, jamais public en écriture. On mute par des **méthodes métier intentionnelles** (`order.markPaid(...)`), on crée par une **factory statique** qui valide (`Order.place(...)`). Lecture par un instantané immuable (`snapshot()`) ou des accesseurs en lecture seule, jamais par des setters.
   - La racine est le seul point d'entrée.
   - Agrégats **petits**.
   - Référence aux autres agrégats **par identité** (`ProductId`), jamais par navigation d'objet.
   - Une commande modifie **un seul** agrégat ; la cohérence avec les autres passe par un événement.
4. **Value Objects** — tout concept sans identité (identifiant typé, montant, email, téléphone, slug, période). Immuables, **auto-validés à la construction** : ils lèvent une exception métier si la valeur est invalide. Les VO transverses vivent dans le noyau partagé.
5. **Repositories** — interface dans `domain/repositories/`, implémentation ORM dans `infrastructure/persistence/`, implémentation **in-memory** dans les tests. Le repository parle en objets de domaine, jamais en entités ORM. La reconstitution depuis la base **ne repasse pas** par les invariants de création (méthode `reconstitute(...)` dédiée).
6. **Exceptions métier** — dans `domain/exceptions/`, nommées par intention (`OrderNotPayableException`, `SubdomainTakenException`). Messages centralisés selon la convention du projet. Les erreurs système remontent dans le type prévu par le projet (par exemple `TransactionalException`) et **ne sont jamais attrapées dans un handler**.
7. **Événements** — nommés **au passé**, immuables (`OrderPaid`, `ContactCaptured`).
   - `DomainEvent` : réaction **synchrone dans la transaction**, au sein du même domaine ou pour un invariant fort.
   - `IntegrationEvent` : communication **inter-domaines après commit**, via outbox ou broker selon le projet. Livraison au moins une fois : le consommateur doit être idempotent.
   - Subscriber = une classe dédiée qui instancie ou appelle le handler cible ; aucune logique métier dans le subscriber lui-même.
   - Tout nouvel événement est documenté dans `docs/events.md` (émetteur, consommateurs, charge utile, synchrone ou post-commit).
8. **Langage ubiquitaire** — le vocabulaire du cahier des charges et du glossaire, mot pour mot. Pas de synonymes. Mélange français/anglais toléré tant qu'il reste cohérent dans un domaine.
9. **Multi-tenant** — presque tout agrégat appartient à un tenant (clé déclarée dans la fiche projet). C'est un **invariant de domaine** : une opération ne traverse jamais deux tenants, et le tenant vient du contexte d'authentification, jamais du corps de la requête.

## Équivalents par langage

| Concept | Java 21+ | TypeScript | PHP 8.2+ | Python 3.12+ |
| --- | --- | --- | --- | --- |
| Value Object | `record` avec validation dans le constructeur compact | classe `readonly` à constructeur privé + `static create()` | `final readonly class` | `@dataclass(frozen=True)` + `__post_init__` |
| Union d'états / variantes | `sealed interface` + `record` | union discriminée | enum adossé + classes | `Literal` + dataclasses |
| Événement | `record` implémentant `DomainEvent` | classe `readonly` | `final readonly class` | dataclass gelée |
| Identifiant typé | `record OrderId(UUID value)` | type « branded » | VO dédié | `NewType` ou dataclass |

## Anti-patterns à refuser

- Logique métier dans un contrôleur, une fabrique de commande, une entité ORM ou un subscriber.
- Handler « anémique » qui manipule directement des entités ORM.
- Fuite du framework, de l'ORM ou d'HTTP dans `domain/` ou `application/`.
- Setters publics qui contournent les invariants.
- Appel direct d'un handler d'un autre domaine depuis un handler (→ événement).
- Identifiant de tenant accepté depuis le client.

## Checklist avant de valider

- [ ] Le concept est-il dans le bon domaine (vérifié dans `docs/domains.md`) ?
- [ ] `domain/` reste-t-il pur ?
- [ ] Invariants garantis à la construction (VO et agrégat) ?
- [ ] Frontières d'agrégat respectées (référence par identifiant, un agrégat modifié par commande) ?
- [ ] Nouvel événement documenté dans `docs/events.md`, consommateur idempotent ?
- [ ] Vocabulaire conforme au glossaire ?
