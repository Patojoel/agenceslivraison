# Conventions d'intégration

## Contrat actuel

- Préfixe commun : `/api/v1`. Les exemples utilisent des chemins relatifs à l'origine configurée de l'API ; ne pas coder une adresse de serveur en dur dans le frontend.
- Les réponses des endpoints de santé sont en JSON. Le démarrage local est décrit dans le [README backend](../README.md).
- L'inscription et la connexion sont disponibles mais les autorisations métier ne sont pas encore implémentées. Ne pas construire de parcours connecté sur les routes envisagées et ne pas interpréter la présence d'une interface comme une permission serveur.
- Tant que PostgreSQL ou les migrations ne sont pas prêts, toutes les routes sauf les sondes de santé répondent 503.
- Les erreurs HTTP utilisent `application/problem+json` avec `type`, `title`, `status`, `detail`, `instance`, `code` et `traceId`. Les erreurs de champs ne sont pas encore implémentées.

## Concurrence optimiste : `ETag` et `If-Match`

Une ressource versionnée (aujourd'hui l'agence) renvoie sa version dans l'en-tête `ETag` (`"3"`) et dans le corps (`version`) sur sa lecture et après chaque modification. Une modification doit renvoyer cette version dans `If-Match` :

- formes acceptées : `"3"` ou `3` (un entier de 1 à 2 147 483 647, sans espace interne) ;
- en-tête absent : **428** Precondition Required (Problem Details), rien n'est écrit ;
- en-tête mal formé (`abc`, `W/"3"`, liste, `*`, `0`, valeur trop grande, vide) : **400** ;
- version qui n'est plus la version courante : **409**, rien n'est écrit, il faut relire la ressource ;
- une modification réussie incrémente la version et renvoie la nouvelle dans `ETag` et dans le corps ; une demande qui ne change aucune valeur réussit sans écrire ni incrémenter.

## Conventions cibles — non garanties par le code actuel

Le cadrage prévoit du JSON en `camelCase`, des listes `{ items, nextCursor, hasMore }`, des filtres autorisés et des limites bornées. Les erreurs devraient suivre RFC 9457 (`type`, `title`, `status`, `detail`, `instance`, `code`, `fieldErrors`, `traceId`). Les mutations critiques devraient utiliser `Idempotency-Key` (déjà en place, facultative, sur `POST /agencies` : voir [Agences et onboarding](routes/agences-onboarding.md)) ; les mises à jour sensibles à la concurrence utilisent `If-Match` (déjà en place sur l'identité et le profil d'agence, voir ci-dessous). Ces éléments doivent être documentés et vérifiés lors de leur implémentation avant que les clients en dépendent.

Les interfaces web et mobiles utiliseront le même backend avec des autorisations propres à l'acteur et à l'agence active. Ne jamais supposer qu'un identifiant d'agence envoyé par le client suffit pour accéder à ses données. Les choix de connexion, stockage des sessions et rôles restent à implémenter et valider.
