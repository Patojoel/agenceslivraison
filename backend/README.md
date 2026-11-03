# Backend — socle initial

Node.js 22 et Docker Compose sont nécessaires. Ce socle ne contient pas encore de fonctionnalités métier ni d'authentification et ne convient pas à une mise en production.

Depuis `backend/`, copier `.env.example` vers `.env` et remplacer le mot de passe local, puis :

```sh
docker compose up --build -d
docker compose exec api npm run migrate
```

La migration est explicite et répétable. `GET /api/v1/health/live` vérifie le processus ; `GET /api/v1/health/ready` retourne 503 si PostgreSQL ou la migration initiale est indisponible. La documentation OpenAPI est disponible à `/api/v1/docs`. La base n'est pas publiée sur l'hôte ; l'API écoute sur localhost:3000. Éviter les caractères réservés aux URL dans les identifiants PostgreSQL de cet exemple.

Pour développer : `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`. Le test HTTP et PostgreSQL utilise une base dédiée vide : `TEST_DATABASE_URL=postgres://test:test@localhost:5432/delivery_test npm run test:e2e`. Il refuse toute base contenant des tables et applique les migrations ; ne jamais utiliser une base contenant des données. La CI démarre une base isolée pour ce test. Pour arrêter les services sans supprimer la base : `docker compose down`. Le volume PostgreSQL persiste ; prévoir des sauvegardes chiffrées hors machine et tester leur restauration avant toute utilisation réelle.

À compléter : validation de la configuration de production et durcissement sécurité. Les migrations Drizzle sont appliquées dans l’ordre et leur historique est vérifié ; ne jamais modifier une migration déjà appliquée. Définir les schémas dans `src/schema` puis générer les migrations avec `npm run db:generate`.

Le [guide d'exploitation](docs/operations/exploitation.md) décrit le modèle de production, les secrets et les sauvegardes.
L'architecture du code (modules, agrégats, règles) est décrite dans [domaines](docs/domains.md), les événements de domaine et l'audit dans [événements](docs/events.md).

La [documentation des routes pour les clients](docs/README.md) regroupe les contrats disponibles et les domaines prévus.

## Développement et tests Docker

Pour le rechargement automatique : `docker compose -f compose.yaml -f compose.dev.yaml up --build -d`, puis `docker compose exec api npm run migrate`. Lancer d'abord la compilation locale si le code de migration a changé : l'image utilise la version compilée.

Pour le test de bout en bout sur une base éphémère séparée, exécuter depuis `backend/` :

```sh
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from test-api
docker compose -f compose.test.yaml down
```

Cette base de test en mémoire est détruite à l'arrêt du conteneur. Le test vérifie qu'elle ne contient aucune table avant d'appliquer les migrations. Ne jamais le faire pointer sur une base réelle. La CI distante n'a pas encore été exécutée par ce projet.
