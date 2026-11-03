# Transferts inter-agences

**Statut : spécification de préparation, pas code implémenté.**

## Objectif et acteurs
Back-office agence, plateforme ou application mobile selon les actions ; contrôler l'accès à chaque opération selon le contexte d'authentification. Les clients externes n'ont jamais un accès implicite au tenant.

## Agrégats candidats
Transfer, Handover. **À confirmer au moment de l'Example Mapping** : séparer si un invariant transactionnel ou le cycle de vie le justifie.

## Cas d'usage / CRUD métier
1. **UC-13-01 — Demander transfert** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
2. **UC-13-02 — accepter côté destination** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
3. **UC-13-03 — préparer** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
4. **UC-13-04 — expédier** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
5. **UC-13-05 — attester remise** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
6. **UC-13-06 — attester réception** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
7. **UC-13-07 — signaler écart** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
8. **UC-13-08 — clôturer** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.

## Règles métier à préserver
- **RM-13-01** : Source et destination distinctes possibles.
- **RM-13-02** : consentement explicite destination.
- **RM-13-03** : propriété du stock inchangée.
- **RM-13-04** : preuve remise + réception.
- **RM-13-05** : litige si écart.
- **RM-13-06** : accès inter-tenant strictement borné.

## API REST indicative
`POST /transfers; POST /transfers/{id}/accept; POST /transfers/{id}/dispatch; POST /transfers/{id}/receive; POST /transfers/{id}/dispute`

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
