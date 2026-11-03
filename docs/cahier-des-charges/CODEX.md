# Contrat d'exécution Codex

Tu implémentes le backend d'une marketplace logistique au Cameroun, en NestJS et TypeScript strict. **Ne commence pas à générer tous les modules simultanément.**

## Procédure obligatoire à chaque lot
1. Lire README, architecture, fiche métier du module et les skills fournis (`core-ddd`, `core-hexagonal`, `core-tdd`, `core-security`, `core-sql-query`, `core-clean-code`, `core-usecase`, `nestjs`, `plan-avant-implementation`, `review and correction`).
2. Auditer le dépôt existant ; ne pas écraser le travail en place.
3. Proposer un plan borné : objectifs, fichiers, dépendances, règles, migrations, tests, risques. **Attendre validation pour le code.**
4. Dès le premier lot validé : rendre `docker compose up --build` fonctionnel pour API + PostgreSQL, migration et healthcheck. Ne jamais créer un backend qui ne fonctionne que hors Docker.
5. Pour chaque comportement : TDD Red → Green → Refactor ; tests unitaires de domaine, intégration PostgreSQL réelle et E2E HTTP.
6. Faire typecheck, lint, tests, build et contrôle de sécurité ; fournir les résultats exacts, sans annoncer un succès non vérifié.
7. Terminer un module complet avant le suivant : cas nominal, refus métier, concurrence, autorisation, isolation tenant, pagination, audit, OpenAPI.

## Contraintes techniques
- Monolithe modulaire NestJS, PostgreSQL + Drizzle, migrations versionnées ; pas de microservices ni RabbitMQ au départ.
- DDD + hexagonal + CQRS léger (handlers commandes et queries), pas de couches cérémonielles inutiles.
- Domaine pur TypeScript ; interfaces de repositories et ports ; injection par Symbol ; HTTP et Drizzle uniquement dans infrastructure.
- Transaction de commande et propagation du contexte transactionnel ; publier les événements d'intégration uniquement après commit (outbox lors de besoins inter-domaines réels).
- Requêtes SQL paramétrées, tenant filtré à l'entrée, index composites ; ne jamais accepter `tenantId` arbitraire dans un corps HTTP.
- API REST versionnée `/api/v1`, OpenAPI, erreurs Problem Details, pagination stable, idempotence pour les créations à risque de doublon.
- `userId`, `agencyId`, `merchantId` sont des identités distinctes. Un utilisateur peut avoir plusieurs memberships ; le contexte agence actif est vérifié côté serveur.
- Aucun `any`, aucun secret en Git, pas de JWT dans localStorage ; auth mobile avec PKCE si fournisseur externe ou access token court + refresh rotation stocké de façon sécurisée.
- Pas de module paiement, notification, messagerie, WhatsApp ou facturation transactionnelle pendant les premiers lots. Conserver des événements métier sans brancher ces canaux.
- Mobile livreur et commerçant : mêmes invariants serveur, endpoints/permissions adaptés, pas de logique métier répliquée côté mobile.

## Format de fin de lot
Fichiers modifiés ; règles implémentées ; endpoints ; migrations ; tests et commandes réellement exécutés ; risques ; décisions ouvertes ; proposition du lot suivant.
