# Clients et commerçants

**Statut : spécification de préparation, pas code implémenté.**

## Objectif et acteurs
Back-office agence, plateforme ou application mobile selon les actions ; contrôler l'accès à chaque opération selon le contexte d'authentification. Les clients externes n'ont jamais un accès implicite au tenant.

## Agrégats candidats
AgencyCustomer, MerchantProfile. **À confirmer au moment de l'Example Mapping** : séparer si un invariant transactionnel ou le cycle de vie le justifie.

## Cas d'usage / CRUD métier
1. **UC-04-01 — Créer client** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
2. **UC-04-02 — modifier** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
3. **UC-04-03 — fusionner doublons contrôlée** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
4. **UC-04-04 — archiver** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
5. **UC-04-05 — consulter historique** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
6. **UC-04-06 — créer profil commerçant** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
7. **UC-04-07 — associer agences** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.

## Règles métier à préserver
- **RM-04-01** : Client d’agence privé.
- **RM-04-02** : marchand peut travailler avec plusieurs agences.
- **RM-04-03** : suppression physique interdite si commandes historiques.
- **RM-04-04** : contact unique non présumé.

## API REST indicative
`POST /customers; GET /customers; PATCH /customers/{id}; POST /customers/{id}/archive; POST /merchants/profile`

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
