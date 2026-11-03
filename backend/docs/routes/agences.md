# Agences : création d’un brouillon

## `POST /api/v1/agencies`

Tout compte connecté peut créer une agence en brouillon. Son compte devient le premier propriétaire. Le brouillon n'est pas approuvé, ne figure pas dans une marketplace et n'active aucune capacité.

En-têtes requis :

- `Authorization: Bearer <accessToken>`.
- `Idempotency-Key: <uuid>` : générer un UUID par demande de création et le conserver pour les nouvelles tentatives de la même demande.

Corps JSON :

```json
{ "name": "Agence Douala" }
```

Le nom est nécessaire, sans espaces en début ou fin, et limité à 160 caractères après normalisation. Les champs supplémentaires sont refusés.

**201 Created** : `{ "id": "uuid", "status": "draft" }`. Une nouvelle tentative avec la même clé et le même nom renvoie le même identifiant ; réutiliser une clé avec un autre nom renvoie **409**. Les clés sont propres au compte connecté.

Autres réponses : **400** pour des données ou une clé invalides, **401** pour une session non authentifiée, **429** au-delà de dix tentatives par adresse client et par minute sur une instance, **503** si la base ou les migrations sont indisponibles. La création de l'agence, du membership propriétaire et de l'audit est atomique.

La validation par la plateforme, les zones et les capacités ne sont pas encore implémentées. Le statut `draft` ne signifie pas qu'une agence est vérifiée ou autorisée à exercer.

## `GET /api/v1/agencies/{agencyId}/onboarding`

Retourne l'état du dossier à un membre actif de l'agence. Fournir `Authorization: Bearer <accessToken>`.

**200 OK** : `{ "id": "uuid", "name": "Agence Douala", "phone": null, "city": null, "version": 1, "status": "draft" }`. Les anciennes agences techniques peuvent avoir un nom `null`. Les statuts actuellement définis sont `draft` et `submitted` ; la soumission est décrite ci-dessous.

**400** : identifiant invalide ; **401** : session absente ou invalide ; **404** : agence inexistante ou accès absent ; **503** : base indisponible.

## `PATCH /api/v1/agencies/{agencyId}`

Le propriétaire ou un administrateur peut modifier un brouillon. Fournir `Authorization: Bearer <accessToken>` et `If-Match: "1"`, en remplaçant `1` par la version reçue à la lecture. Le corps contient au moins un champ parmi `name`, `phone` et `city` :

```json
{ "phone": "+237 699123456", "city": "Douala" }
```

Le téléphone accepte un `+` initial, chiffres, espaces, parenthèses et tirets ; il doit contenir 6 à 15 chiffres. La ville comporte 1 à 100 caractères après suppression des espaces en bordure. Réponse **200** : `{ "id": "uuid", "status": "draft", "version": 2 }`.

## `POST /api/v1/agencies/{agencyId}/submit`

Le propriétaire ou un administrateur soumet un brouillon disposant d'un nom, d'un téléphone et d'une ville. Fournir le même en-tête `If-Match` avec la dernière version. Il n'y a pas de corps. Réponse **200** : `{ "id": "uuid", "status": "submitted", "version": 3 }`. La soumission ne vaut pas approbation ni validation de l'agence.

Pour les deux routes : **400** données ou version invalides, **401** session absente ou invalide, **403** rôle insuffisant, **404** agence inaccessible, **409** état incompatible ou informations manquantes, **412** version obsolète, **503** base indisponible. Après soumission, les modifications sont refusées en attendant la définition du processus d'examen. Chaque changement réussi est audité.
