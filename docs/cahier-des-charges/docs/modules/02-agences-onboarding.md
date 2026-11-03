# Agences et onboarding

**Statut : spécification de préparation, pas code implémenté.**

## Objectif et acteurs
Back-office agence, plateforme ou application mobile selon les actions ; contrôler l'accès à chaque opération selon le contexte d'authentification. Les clients externes n'ont jamais un accès implicite au tenant.

## Agrégats candidats
Agency, AgencyLocation, Capability. **À confirmer au moment de l'Example Mapping** : séparer si un invariant transactionnel ou le cycle de vie le justifie.

## Cas d'usage / CRUD métier
1. **UC-02-01 — Créer brouillon** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
2. **UC-02-02 — compléter identité** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
3. **UC-02-03 — renseigner zones** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
4. **UC-02-04 — activer capacités livraison/stockage** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
5. **UC-02-05 — soumettre vérification** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
6. **UC-02-06 — modifier profil** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
7. **UC-02-07 — suspendre capacité** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
8. **UC-02-08 — gérer sites** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.

## Règles métier à préserver
- **RM-02-01** : Une agence non approuvée peut être brouillon.
- **RM-02-02** : capacité doit avoir configuration minimale.
- **RM-02-03** : suspension bloque nouvelles demandes sans effacer historique.
- **RM-02-04** : vérification ne signifie pas assurance.

## API REST indicative
`POST /agencies; PATCH /agencies/{id}; POST /agencies/{id}/submit; POST /agencies/{id}/capabilities; GET /agencies/{id}/onboarding`

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
