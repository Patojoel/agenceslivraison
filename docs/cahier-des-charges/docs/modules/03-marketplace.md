# Annuaire public et demandes

**Statut : spécification de préparation, pas code implémenté.**

## Objectif et acteurs
Back-office agence, plateforme ou application mobile selon les actions ; contrôler l'accès à chaque opération selon le contexte d'authentification. Les clients externes n'ont jamais un accès implicite au tenant.

## Agrégats candidats
AgencyPublicProfile, ServiceRequest. **À confirmer au moment de l'Example Mapping** : séparer si un invariant transactionnel ou le cycle de vie le justifie.

## Cas d'usage / CRUD métier
1. **UC-03-01 — Publier fiche** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
2. **UC-03-02 — rechercher** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
3. **UC-03-03 — filtrer par zone/capacité** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
4. **UC-03-04 — consulter** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
5. **UC-03-05 — demander prestation** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
6. **UC-03-06 — retirer demande** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.
7. **UC-03-07 — accepter/refuser demande** : définir préconditions, acteur autorisé, entrées validées, sortie, statut HTTP, audit, effet concurrent, rollback et test négatif.

## Règles métier à préserver
- **RM-03-01** : Fiche publique n’expose pas clients internes.
- **RM-03-02** : demande != commande.
- **RM-03-03** : refus conserve audit.
- **RM-03-04** : demande acceptée une fois.
- **RM-03-05** : tarifs affichés non garantis sans devis.

## API REST indicative
`GET /public/agencies; GET /public/agencies/{slug}; POST /service-requests; GET /service-requests; POST /service-requests/{id}/accept; POST /service-requests/{id}/reject`

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
