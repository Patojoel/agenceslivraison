# Conventions HTTP et clients web/mobile

- Préfixe `/api/v1`, JSON camelCase, OpenAPI versionné et générateur de types clients.
- Mutations POST/PATCH/DELETE avec validation, autorisation serveur, audit, `Idempotency-Key` pour acceptation de demandes, création de commandes et transferts critiques.
- Erreurs RFC 9457 Problem Details (`type`, `title`, `status`, `detail`, `instance`, `code`, `fieldErrors`, `traceId`). Pas d'erreur brute SQL.
- GET liste : `items`, `nextCursor`, `hasMore` ; filtres allowlist ; `limit` borné.
- `If-Match` / version d'agrégat pour modifications concurrentes sensibles.
- Les clients mobile livreur et commerçant consomment le même contrat et ne disposent que des endpoints autorisés par scopes/permissions.
- Le client mobile livreur peut travailler sur réseau intermittent : horodatage source, identifiant d'action idempotent, reprise explicite ; le serveur est source de vérité.

## Groupes d'API à développer dans l'ordre
`/auth`, `/me`, `/agencies`, `/agency-members`, `/agency-onboarding`, `/public/agencies`, `/customers`, `/merchants`, `/service-requests`, `/orders`, `/parcels`, `/couriers`, `/delivery-tasks`, `/warehouses`, `/inventory`, `/stock-reservations`, `/fulfillment`, `/transfers`, `/tracking`, `/returns`, `/claims`, `/admin`, `/reports`.

Chaque fiche module précise endpoints indicatifs ; ne jamais exposer un CRUD destructeur sur un agrégat opérationnel historisé sans règle métier explicite.
