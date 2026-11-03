# Backend — socle initial

Node.js 22 et Docker Compose sont nécessaires. Ce socle ne contient pas encore de fonctionnalités métier ni d'authentification et ne convient pas à une mise en production.

Depuis `backend/`, copier `.env.example` vers `.env` et remplacer le mot de passe local, puis :

```sh
docker compose up --build -d
docker compose exec api npm run migrate
```

La migration est explicite et répétable. `GET /api/v1/health/live` vérifie le processus ; `GET /api/v1/health/ready` retourne 503 si PostgreSQL ou la migration initiale est indisponible. La documentation OpenAPI est disponible à `/api/v1/docs`. La base n'est pas publiée sur l'hôte ; l'API écoute sur localhost:3000. Éviter les caractères réservés aux URL dans les identifiants PostgreSQL de cet exemple.

Pour développer : `npm ci`, `npm run typecheck`, `npm run build`, `npm test`. Pour arrêter les services sans supprimer la base : `docker compose down`. Le volume PostgreSQL persiste ; prévoir des sauvegardes chiffrées hors machine et tester leur restauration avant toute utilisation réelle.

À compléter : migrations Drizzle, tests d'intégration PostgreSQL et E2E, CI, lint, configuration de développement et de production, gestion des erreurs RFC 9457 et durcissement sécurité.
