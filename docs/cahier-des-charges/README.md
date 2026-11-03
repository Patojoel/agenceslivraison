# Pack de cadrage backend NestJS — marketplace logistique

**Statut : spécifications pour Codex, pas backend déjà développé.** Les fichiers sont destinés à être lus avant toute implémentation. La création du code applicatif et de la configuration Docker opérationnelle intervient après validation du plan, conformément au skill `plan-avant-implementation` fourni.

## Décisions confirmées
- Marché initial : Cameroun ; clients particuliers et commerçants.
- Agences : livraison, stockage, hybrides ; back-office multi-tenant.
- Paiements : directs à l'agence ; **aucune collecte, commission ou split payment plateforme au MVP**.
- Notifications, messagerie et intégrations de paiement **reportées** ; ne pas les développer dans les premiers lots.
- Applications mobiles futures : livreurs et commerçants ; API partagée, autorisations propres à chaque acteur.
- **Docker obligatoire dès le premier commit de code** : API + PostgreSQL séparé ; migrations, healthchecks, volumes, réseau et sauvegardes hors conteneur.

## Ordre de lecture
1. `CODEX.md` — instructions de l'agent
2. `docs/architecture/01-decisions.md` et `02-architecture.md`
3. `docs/architecture/03-donnees-securite.md`
4. `docs/architecture/04-docker-exploitation.md`
5. `docs/delivery/roadmap.md` et `docs/delivery/acceptance.md`
6. `docs/modules/*.md` — fiches de chaque domaine
7. `docs/architecture/05-contrats-api.md` et `06-evenements.md`

## Étiquettes
- **CONFIRMÉ** : choix communiqué par le commanditaire.
- **RECOMMANDÉ** : choix technique motivé, modifiable après audit.
- **À VALIDER** : décision métier non encore fixée. Ne pas coder comme vérité.

## Remarque
Le budget d'exploitation technique cible est de **60 000 FCFA/mois**, pas un dimensionnement garanti. Les 50 agences et 5 000 commandes mensuelles sont des hypothèses de prévisionnel, pas des quotas métier.
