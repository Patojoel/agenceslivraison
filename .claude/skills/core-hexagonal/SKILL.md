---
name: "core-hexagonal"
description: Architecture hexagonale (ports & adapters) + CQRS générique pour tous les backends (Spring Boot, NestJS, Laravel, FastAPI) et règles de placement de fichiers. Charge ce skill pour structurer un cas d'usage, ajouter un contrôleur ou un endpoint, câbler un handler, ajouter un adapter vers un service tiers (paiement, email, stockage), décider où placer un fichier ou vérifier le sens des dépendances. Contient une référence détaillée par stack dans references/. Pour le front, voir core-front-stack.
---

# Architecture hexagonale + CQRS

**Priorité** : la structure réelle du dépôt et `CLAUDE.md` priment. Si le projet existe, repère un cas d'usage voisin du **même module** et reproduis ses conventions exactes avant d'appliquer ce skill. Ce skill sert de défaut pour un projet neuf et de grille de contrôle pour un projet existant.

## Étape 1 — Identifier la stack

Lis la « Fiche projet » de `CLAUDE.md`, sinon déduis-la des fichiers de build, puis lis **une seule** référence :

| Indice | Référence |
| --- | --- |
| `pom.xml` / `build.gradle` + Spring Boot | `references/spring-boot.md` |
| `package.json` avec `@nestjs/core` | `references/nestjs.md` |
| `composer.json` avec `laravel/framework` | `references/laravel.md` |
| `pyproject.toml` / `requirements.txt` avec `fastapi` | `references/fastapi.md` |

## Couches (toutes stacks)

- **`domain/`** — agrégats, value objects, interfaces de repository, exceptions, événements. **Pur.** Voir `core-ddd`.
- **`application/`** — CQRS :
  - `command/<CasUsage>/` : `Command` (immuable) + `Handler` (dépendances par constructeur) + `Response` (immuable). Le handler **orchestre** : charge l'agrégat, vérifie l'autorisation, appelle le domaine, persiste, publie. Les règles métier vivent dans le domaine.
  - `queries/<CasUsage>/` : `QueryHandler` + `Response` + `DTO`, en SQL paramétré, sans entité ORM en sortie. Voir `core-sql-query`.
  - `subscribers/` : réactions aux événements, une classe par réaction.
  - `ports/` : interfaces vers les services tiers qui ne sont pas des repositories (`PaymentGateway`, `EmailSender`, `ObjectStorage`).
- **`infrastructure/`** — persistance (entités ORM, repositories concrets, mappers), adapters des ports, câblage de l'injection, couche HTTP (contrôleur mince, requêtes, fabrique Request → Command), jobs planifiés.

## Flux d'une écriture

```
HTTP → Contrôleur (mince) → Fabrique Request → Command
     → Décorateur transactionnel(Handler).handle(command)
         → Agrégat (règles) → Repository → événements collectés
     → commit → événements d'intégration publiés (outbox / broker)
     → Response → format HTTP du projet (DTO ou enveloppe, erreurs RFC 7807 ou format maison)
```

## Règles

1. **Sens des dépendances** : infrastructure → application → domain. Jamais l'inverse.
2. **Transaction** : un contrôleur n'appelle jamais un handler nu ; il passe toujours par le décorateur transactionnel du projet.
3. **Contrôleur mince** : construit la commande, appelle le handler décoré, mappe la réponse. Aucune logique métier, aucune requête SQL.
4. **Câblage** : chaque handler est déclaré explicitement dans la configuration d'injection du module (bean, provider, binding) selon le style du module.
5. **Queries** : SQL paramétré, objets immuables, filtrage par tenant dès l'entrée, testées en E2E.
6. **Migrations** : toute table, colonne ou index passe par l'outil de migration du projet (Liquibase, Flyway, Drizzle, migrations Laravel, Alembic). L'ORM ne génère jamais le schéma en production (`validate` au mieux).
7. **Inter-domaines** : par événement, pas par appel direct d'un handler d'un autre domaine. Une lecture synchrone d'un autre domaine passe par une interface explicitement exposée par ce domaine.
8. **Adapters tiers** : un port par capacité, une implémentation par fournisseur, plus une implémentation factice activable en développement (paiement simulé, email capturé).
9. **Endpoint public** : listé explicitement dans la configuration de sécurité (jamais un motif large), rate-limité, et justifié. Voir `core-security`.
10. **Documentation** : nouveau domaine ou cas d'usage → `docs/domains.md` ; nouvel événement → `docs/events.md` ; migration → historique des migrations si le projet en tient un.

## Front-end — hexagonal par module

Le front React + Vite + Redux Toolkit applique la même séparation, détaillée dans `core-front-stack` :

- `models/` (types de domaine) + `models/gateway/<Module>Gateway.ts` = **port** ;
- `usecases/<cas>/` = triplet `Command` / `Response` / `Async` (thunk) ;
- `slice/` + `<Module>Selector.ts`, `listeners/` pour les effets ;
- `infra/repo/<Module>HttpGateway.ts` = **adapter** sur `HttpClient`, avec `api-routes/`, `validators/` (Zod), `factories/`, `routes/` et `ui/`.

Les adapters sont instanciés dans `lib/store/dependencies/` et injectés en `extraArgument` : jamais d'import d'un `*HttpGateway` dans un thunk, un slice ou un composant.

## Checklist avant de valider

- [ ] Chaque fichier est-il dans la bonne couche, au même endroit qu'un cas d'usage voisin ?
- [ ] Sens des dépendances respecté (aucun import d'infrastructure depuis `domain/` ou `application/`) ?
- [ ] Handler appelé via le décorateur transactionnel ?
- [ ] Handler câblé explicitement dans l'injection ?
- [ ] Query en SQL paramétré + immuable + filtrée par tenant ?
- [ ] Changement de schéma → migration + documentation ?
- [ ] Se combine avec `core-ddd`, `core-tdd`, `core-clean-code`.
