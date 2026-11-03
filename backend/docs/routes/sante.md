# Santé et disponibilité

Ces routes sont implémentées, accessibles sans authentification et destinées au suivi technique. Elles ne représentent pas des fonctionnalités métier.

## `GET /api/v1/health/live`

Vérifie que le processus HTTP répond, indépendamment de PostgreSQL. Aucun paramètre ni corps de requête.

**200 OK** — `Content-Type: application/json` :

```json
{ "status": "ok" }
```

## `GET /api/v1/health/ready`

Vérifie l'accès à PostgreSQL et l'application de tous les fichiers de migration reconnus par l'API. Aucun paramètre ni corps de requête.

**200 OK** — toutes les vérifications réussissent :

```json
{ "status": "ok" }
```

**503 Service Unavailable** — base inaccessible, table des migrations absente, migration manquante ou fichiers de migration indisponibles. Réponse `application/problem+json` (le `traceId` varie à chaque erreur) :

```json
{ "type": "about:blank", "title": "Service Unavailable", "status": 503, "detail": "Database not ready", "instance": "/api/v1/health/ready", "code": "SERVICE_UNAVAILABLE", "traceId": "exemple" }
```

Un client peut afficher un état temporairement indisponible et réessayer avec un délai. Ne pas utiliser `live` pour déduire que la base est prête. La cause technique exacte n'est pas exposée dans la réponse.
