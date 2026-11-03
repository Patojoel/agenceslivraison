# Prompt initial à copier dans Codex

Lis entièrement `README.md`, `CODEX.md`, `docs/architecture/*`, `docs/delivery/*` et les fiches métier pertinentes. Applique les skills joints `nestjs`, `core-ddd`, `core-hexagonal`, `core-tdd`, `core-security`, `core-clean-code`, `core-sql-query`, `core-usecase`, `plan avant implementation`, `review and correction`.

Nous allons construire **progressivement** le backend NestJS d'une marketplace logistique multi-tenant au Cameroun. Docker est obligatoire **dès le premier commit de code** : NestJS API et PostgreSQL séparés, migrations, healthchecks, tests et sauvegardes documentées. Prévoir les clients web et mobiles (livreurs, commerçants) dans les contrats HTTP.

**Ta première mission est uniquement le LOT 0**. Audite le dépôt. Présente un plan détaillé (arborescence, versions compatibles à vérifier, Dockerfile, Compose, env, Drizzle, migrations, tests, CI, sécurité et critères de validation), et attends mon approbation avant d'écrire le code. Après validation, implémente, exécute réellement les tests, puis arrête-toi. Ne passe jamais au lot suivant sans validation.

Interdiction de développer les paiements, notifications, messagerie, WhatsApp, abonnements facturés et microservices dans les premiers lots. Les clients paient directement les agences ; aucune commission plateforme au MVP. N'invente pas les règles métier ouvertes : documente-les et demande validation.
