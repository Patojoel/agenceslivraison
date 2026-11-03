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

Les étapes de soumission, de validation, de zones et de capacités ne sont pas encore implémentées. Le statut `draft` ne signifie pas qu'une agence est vérifiée ou autorisée à exercer.

## `GET /api/v1/agencies/{agencyId}/onboarding`

Retourne l'état du dossier à un membre actif de l'agence. Fournir `Authorization: Bearer <accessToken>`.

**200 OK** : `{ "id": "uuid", "name": "Agence Douala", "status": "draft" }`. Les anciennes agences techniques peuvent avoir un nom `null`. Les statuts actuellement définis sont `draft` et `submitted` ; aucune route de soumission n'est encore disponible.

**400** : identifiant invalide ; **401** : session absente ou invalide ; **404** : agence inexistante ou accès absent ; **503** : base indisponible.
