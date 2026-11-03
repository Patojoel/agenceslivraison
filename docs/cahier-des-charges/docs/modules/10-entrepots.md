# Entrepôts et emplacements

**Statut : spécification de préparation, pas code implémenté.**

## Objectif et acteurs
Back-office agence, plateforme ou application mobile selon les actions ; contrôler l'accès à chaque opération selon le contexte d'authentification. Les clients externes n'ont jamais un accès implicite au tenant.

## Agrégats candidats
Warehouse, StorageBin. **À confirmer au moment de l'Example Mapping** : séparer si un invariant transactionnel ou le cycle de vie le justifie.

## Cas d'usage / CRUD métier
1. **UC-10-01 — Créer entrepôt** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
2. **UC-10-02 — modifier** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
3. **UC-10-03 — archiver** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
4. **UC-10-04 — créer emplacement** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
5. **UC-10-05 — bloquer emplacement** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
6. **UC-10-06 — consulter capacité** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
7. **UC-10-07 — lister mouvements** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.

## Règles métier à préserver
- **RM-10-01** : Entrepôt d’agence stockage/hybride.
- **RM-10-02** : pas d’archivage avec stock actif.
- **RM-10-03** : capacité non négative.
- **RM-10-04** : un emplacement bloqué ne reçoit pas de nouvelle entrée.

## API REST indicative
`POST /warehouses; PATCH /warehouses/{id}; POST /warehouses/{id}/bins; PATCH /bins/{id}`

## Cycle TDD exigé
- Test unitaire du domaine : état initial, nominal, interdit, borne, duplication.
- Test application avec repositories in-memory, horloge/UUID déterministes.
- Test intégration PostgreSQL : migrations, contraintes, concurrence, isolation tenant.
- Test E2E HTTP : 200/201, 400/422, 401, 403, 404 autre tenant, 409 conflit.
- Test de lecture : pagination, tri, filtres, projection minimale.

## Questions ouvertes
- Quels rôles exacts et quelles validations humaines sont nécessaires pour ce module ?
- Quels statuts et transitions doivent être approuvés par les opérateurs métier ?
- Quels documents, champs obligatoires, délais de conservation et quotas s’appliquent ?

## Definition of Done
OpenAPI à jour ; migrations ; contrôles tenant ; audit ; tests verts exécutés ; Docker Compose opérationnel ; aucune notification ni paiement ajouté implicitement.
