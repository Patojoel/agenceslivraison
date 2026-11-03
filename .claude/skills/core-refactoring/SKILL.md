---
name: "core-refactoring"
description: Refactoring sûr pour tous les projets (backend Java, TypeScript, PHP, Python et frontend React + Vite + Redux Toolkit) — modifier la structure sans changer le comportement, sous tests verts, par petits pas atomiques. Charge ce skill quand la tâche est « refactore », « nettoie », « simplifie », « déplace », « extrais » ou « découple » un module, ou avant de toucher du code existant non couvert. Partage le catalogue de smells de core-clean-code.
---

# Refactoring — comportement préservé, sous tests

Refactorer = changer la **structure** sans changer le **comportement observable**. La sûreté vient des tests. `core-clean-code` dit comment écrire juste du premier coup ; ici on corrige après.

## Règle d'entrée : pas de refactoring sans filet

- Le code visé est-il couvert (unit, feature, E2E) ? Oui → refactore sous couverture.
- Non → écris d'abord des **tests de caractérisation** qui figent le comportement **actuel**, bugs compris. Voir `core-tdd`.

## Protocole

1. Tests verts **avant** de commencer (sinon, stabilise d'abord).
2. **Petits pas atomiques** : une transformation à la fois (extraire une méthode, introduire un value object, déplacer une règle vers le domaine, remplacer un appel direct inter-domaine par un événement). Jamais structure et comportement dans le même pas.
3. Tests après chaque pas ; au moindre rouge, retour arrière.
4. Un commit par pas (`refactor: …`).
5. Comportement final identique : contrat HTTP, format d'erreur, événements publiés et schéma de base. Un changement de schéma n'est pas un refactoring : c'est une migration et une feature.

## Quand refactorer — et quand s'abstenir

- **Oui** : un smell **bloque** un changement à venir, ou il est **avéré** et répété (règle de trois).
- **Non** : refactoring spéculatif, ou qui **ajoute** une abstraction sans besoin présent.

## Cibles fréquentes

- **Backend** : handler obèse, contrôleur gras, logique métier dans une entité ORM ou un subscriber, ORM qui fuit dans `domain/`, instanciation d'une dépendance concrète, SQL positionnel ou concaténé, CTE non filtrée, DTO mutable, agrégation en mémoire en O(n²), appel direct du handler d'un autre domaine.
- **Frontend** : logique métier dans un composant, prop-drilling, thunk ou action dupliqués, adapter HTTP importé hors du câblage d'injection, `fetch` direct dans un composant ou un hook, composant « générique » prématuré, texte en dur au lieu de l'i18n, `useEffect` de chargement de données.

## Périmètre

- Ne mélange pas refactoring et feature dans le même lot ni le même commit.
- Reste dans le module demandé ; signale les smells voisins sans les traiter.

## Avant de conclure

- [ ] Comportement inchangé (tests verts, mêmes assertions qu'avant) ?
- [ ] Chaque pas est-il atomique et commité ?
- [ ] N'as-tu pas ajouté de complexité au nom du « propre » ?
