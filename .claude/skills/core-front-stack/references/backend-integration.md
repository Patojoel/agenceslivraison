# Référence — intégration des backends

## Laravel
- CSRF depuis `<meta name="csrf-token">` (Blade) ou cookie `XSRF-TOKEN`, géré dans le fournisseur HTTP.
- Sanctum en cookie : `withCredentials: true` sur toutes les requêtes ; appel à `/sanctum/csrf-cookie` avant le login.
- Erreurs de validation : `{ errors: { champ: string[] } }` → erreurs de champ.
- 419 = CSRF expiré → recharger ; 403 → rediriger ou déconnecter ; 422 → erreurs de champ.

## Spring Boot
- Authentification par Bearer JWT dans `Authorization` (stocké en mémoire serveur ou cookie `HttpOnly`), ou session cookie + CSRF selon le projet.
- Erreurs RFC 7807 : `{ type, title, status, detail }` (+ extension de champs éventuelle) → message utilisateur et erreurs de champ. Certains projets utilisent une enveloppe maison (`CustomResponse<T>`) : lire l'interface HTTP du backend avant de typer.
- Pagination souvent `{ content, totalElements, totalPages, number }`.
- CORS configuré côté serveur (`WebMvcConfigurer`, configuration de sécurité).

## FastAPI
- Bearer JWT, refresh si implémenté.
- Erreurs Pydantic : `{ detail: [{ loc, msg, type }] }` → parcourir `detail` pour les erreurs de champ.
- snake_case → camelCase dans l'adapter.
- WebSocket natif ; OpenAPI à `/docs` pour typer précisément les gateways.

## NestJS
- Bearer JWT (`@nestjs/passport`) ou session cookie selon la configuration.
- Erreurs class-validator : `{ statusCode, message: string[], error }` → erreurs de champ ; erreurs Zod si le projet utilise un pipe Zod.
- camelCase par défaut ; vérifier les éventuels `@Transform`.
- DTO backend et schémas Zod front tenus synchronisés (idéalement générés depuis l'OpenAPI).
- RBAC par guards côté backend ; le front ne fait que refléter pour l'UX.
