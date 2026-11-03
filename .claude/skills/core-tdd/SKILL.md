---
name: "core-tdd"
description: Flux TDD et stratégie de test à 3 niveaux (unit avec fakes in-memory, feature sur vraie base, E2E HTTP) pour tous les projets, backend (Spring Boot, NestJS, Laravel, FastAPI) et frontend (Vitest, Testing Library, Playwright). Charge ce skill avant d'écrire du code applicatif, avant d'écrire ou de modifier des tests, et dès qu'il faut choisir le bon niveau de test ou une doublure. Impose le test d'abord, aucune bibliothèque de mock sur le domaine et l'application, vraie base pour la persistance, queries testées en E2E uniquement, jamais d'affirmation de succès sans exécution.
---

# TDD — Développement piloté par les tests

Règle : **un changement non testé n'est pas terminé.** Les commandes exactes, l'emplacement des tests et le mécanisme de nettoyage de la base sont dans la « Fiche projet » de `CLAUDE.md` ; ils priment sur les défauts ci-dessous.

## Cycle

**Red → Green → Refactor.** Le test qui échoue s'écrit *avant* le code de production. On écrit le minimum pour passer au vert, puis on refactore sous couverture. Commence par le cas dégénéré (vide, zéro), puis le nominal simple, puis les variations et les valeurs limites (borne −1, borne, borne +1).

## Les 3 niveaux backend (forme pyramide)

### 1. Unit
- Instancie **directement** le handler ou l'agrégat, avec des repositories et ports **in-memory**. Aucun conteneur d'injection, aucune I/O.
- **Pas de bibliothèque de mock** (Mockito, `jest.fn` pour simuler un repository, `unittest.mock`) sur le domaine et l'application : la doublure est une implémentation in-memory déterministe de l'interface. Elle est réutilisée par tous les tests du module.
- Horloge et générateur d'identifiants injectés, figés dans le test.
- Données via des **builders** à valeurs par défaut surchargeables.
- Erreur métier → assertion sur la réponse ou l'exception métier. Erreur système → assertion sur le type d'erreur système du projet (jamais attrapée dans le handler).

### 2. Feature (persistance)
- Vrai ORM sur la **vraie base** (même moteur qu'en production), schéma posé par l'outil de migration.
- **Nettoyage obligatoire** entre les tests (annotation, hook ou transaction annulée selon la stack) : sans lui, un test dépend de l'ordre d'exécution.
- Ce qu'on insère est ce qu'on relit ou supprime : identifiants cohérents, sinon l'assertion passe à vide.

### 3. E2E (HTTP)
- Application complète + vraie base + nettoyage. Parcours HTTP → réponse au format du projet.
- **Seul niveau de test des queries** (lectures SQL) : le test E2E s'écrit avant la query.
- Couvre au moins : succès, validation, 401, 403, ressource d'un autre tenant (doit répondre 404 ou 403 selon la convention).

## Outils par stack

| Stack | Unit | Feature | E2E |
| --- | --- | --- | --- |
| Spring Boot | JUnit 5 + AssertJ | `@SpringBootTest` + PostgreSQL réelle | MockMvc |
| NestJS | Vitest ou Jest | idem + PostgreSQL réelle | Supertest |
| Laravel | Pest / PHPUnit | `RefreshDatabase` | tests HTTP Laravel |
| FastAPI | pytest | pytest + PostgreSQL réelle | `httpx.AsyncClient` |

## Frontend

- **Logique** (thunk, slice, sélecteur, listener) testée avec Vitest sur un vrai store : `createTestStore({ <gateway>: new InMemory<Module>Gateway(...) })`, dispatch du thunk, assertion par le sélecteur. Aucun appel réseau réel. On remplace le **port**, jamais la couche HTTP.
- Le fake in-memory vit dans `tests/fakes/` du module, avec une méthode pour simuler une panne (`failNextCallWith(new HttpError(500, …))`) ; les données viennent de builders (`tests/builders/`).
- **Composants** avec Testing Library sur le même store (`renderWithProviders(ui, store)`) : comportement observable par rôles et libellés, pas les détails d'implémentation.
- Modèles complets dans `core-front-stack/references/module-template.md`.
- **Parcours** critiques avec Playwright sur l'application démarrée (paiement simulé côté backend).

## Exécution

- Lance au minimum la classe ou le fichier de test du cas d'usage modifié, et la suite du module si tu touches du code partagé.
- Après un renommage de package ou de dossier, nettoie les artefacts de build avant de relancer.
- **N'affirme jamais qu'un test passe sans avoir vu sa sortie.** Si l'infrastructure manque (base arrêtée, fichier de configuration de test absent), dis-le.
- Ne désactive jamais un test pour « faire passer » : corrige la cause.

## Checklist avant de valider

- [ ] Test écrit avant le code ?
- [ ] Unit = fakes in-memory, aucune bibliothèque de mock, aucune I/O ?
- [ ] Feature et E2E = vraie base + nettoyage ?
- [ ] Query testée en E2E uniquement ?
- [ ] Cas d'isolation tenant couvert sur les endpoints ?
- [ ] Tests exécutés, sortie vue, verts ?
