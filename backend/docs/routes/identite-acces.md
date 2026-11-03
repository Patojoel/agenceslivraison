# Identité et accès — prévu

## Inscription — implémentée

`POST /api/v1/auth/register` crée un compte individuel ou commerçant, sans rôle ni accès agence. Aucun jeton n'est émis par cette route.

Requête JSON :

```json
{ "email": "personne@example.com", "password": "mot de passe suffisamment long", "accountType": "individual" }
```

`accountType` vaut `individual` ou `merchant` ; `email` est normalisé en minuscules, et `password` doit comporter entre 12 et 128 caractères et au plus 256 octets UTF-8. Les champs supplémentaires sont refusés.

- **201** : `{ "id": "uuid", "accountType": "individual" }` (ou `merchant`).
- **400** : données invalides, notamment type `agency` ou mot de passe trop court.
- **409** : adresse déjà enregistrée après normalisation.
- **429** : plus de cinq tentatives par adresse client en 60 secondes sur une instance.
- **503** : base ou migrations indisponibles.

Le mot de passe est haché avec Argon2id et une entrée d'audit est ajoutée dans la même transaction que le compte. Les erreurs utilisent Problem Details ; le mot de passe n'est jamais renvoyé. La limite en mémoire est locale au processus ; le déploiement devra utiliser une limitation partagée et un proxy de confiance correctement configuré.

## Connexion — implémentée

`POST /api/v1/auth/login` accepte `{ "email": "personne@example.com", "password": "..." }` et renvoie **200** avec `{ "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }`. Le jeton d'accès est signé et expire après 15 minutes ; le jeton de renouvellement opaque correspond à une session de 30 jours et seul son condensat est stocké. Une connexion réussie est auditée.

Réponses possibles : **400** données invalides, **401** identifiants invalides, **429** limite dépassée, **503** configuration de signature ou base indisponible. La même erreur 401 est renvoyée pour un compte inconnu et pour un mot de passe incorrect. La limite est de cinq tentatives par adresse client en 60 secondes sur une instance.

Pour le développement, renseigner dans un fichier `.env` ignoré par Git `JWT_SECRET` avec une clé aléatoire d'au moins 32 octets, puis démarrer Compose ; ne jamais utiliser une valeur d'exemple en production. En production, configurer `JWT_SECRET_FILE` comme décrit dans le guide d'exploitation. Éviter `localStorage` pour les jetons et suivre le modèle de stockage sécurisé décidé pour chaque client.

## Session et profil — implémentés

- `POST /api/v1/auth/refresh` prend `{ "refreshToken": "..." }` et renvoie **200** avec de nouveaux `accessToken`, `refreshToken` et `expiresIn`. Le jeton précédent ne peut plus être utilisé ; deux demandes simultanées ne produisent qu'un seul succès. Les sessions expirent après 30 jours sans renouvellement.
- `POST /api/v1/auth/logout` prend `{ "refreshToken": "..." }` et renvoie **200** avec `{ "success": true }`. La session est révoquée ; ses jetons d'accès ne donnent plus accès au profil.
- `GET /api/v1/me` prend `Authorization: Bearer <accessToken>` et renvoie **200** avec `{ "id": "uuid", "email": "personne@example.com", "accountType": "individual" }` ou `merchant`.

Les corps de renouvellement et déconnexion invalides renvoient **400** ; les jetons invalides, expirés, révoqués ou déjà utilisés renvoient **401**. La limite des deux mutations est de dix requêtes par adresse client et par route en 60 secondes, par instance. Les changements de session sont audités. Les jetons d'accès déjà émis restent valides jusqu'à expiration après un simple renouvellement ; la déconnexion les invalide immédiatement via la session.

## Accès agence — implémentés

Toutes ces routes demandent `Authorization: Bearer <accessToken>`. Un membre extérieur à l'agence reçoit **404**, et un membre sans permission reçoit **403**. Les changements sont enregistrés dans l'audit et l'accès du dernier propriétaire actif est protégé, y compris en concurrence.

- `GET /api/v1/me/agencies?limit=20&cursor=<agencyId>` liste uniquement les agences actives du compte. Réponse : `{ "items": [{ "agencyId": "uuid", "role": "owner" }], "nextCursor": null, "hasMore": false }`. `limit` est compris entre 1 et 100 ; le curseur est l'`agencyId` reçu dans `nextCursor`.
- `POST /api/v1/agencies/{agencyId}/invitations` accepte `{ "email": "personne@example.com", "role": "agent" }`, avec `role` égal à `agent` ou `admin`. Réponse **201** : `{ "token": "...", "expiresAt": "date ISO 8601" }`. Le jeton est valable sept jours et n'est retourné qu'à la création. Le transmettre confidentiellement à la personne invitée ; aucun e-mail n'est envoyé automatiquement.
- `POST /api/v1/agency-invitations/accept` prend `{ "token": "..." }` et renvoie **200** avec `{ "agencyId": "uuid", "role": "agent" }`. Le compte connecté doit posséder l'adresse invitée ; un jeton invalide, expiré ou déjà utilisé renvoie **404**. Une personne déjà membre reçoit **409**.
- `PATCH /api/v1/agencies/{agencyId}/members/{memberId}` prend `{ "role": "admin" }` (`owner`, `admin`, `agent`) et renvoie **200** avec `{ "success": true }`. `memberId` est l'identifiant du membership, pas l'identifiant utilisateur.
- `DELETE /api/v1/agencies/{agencyId}/members/{memberId}` désactive le membership et renvoie **200** avec `{ "success": true }`. Aucun membre ne peut modifier ou supprimer son propre accès avec ces routes ; la suppression du dernier propriétaire renvoie **409**.

Politique initiale : un propriétaire gère les rôles et invite des administrateurs ou agents ; un administrateur peut inviter et gérer uniquement des agents ; un agent ne gère pas les accès. L'invitation ne crée pas de propriétaire. La [création du brouillon](agences.md) attribue le premier rôle propriétaire au compte créateur.

## Parcours prévus

Les chemins suivants restent indicatifs ; les routes décrites ci-dessus sont disponibles :

| Méthode | Chemin indicatif | Intention |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Créer un compte — implémenté |
| POST | `/api/v1/auth/login` | Se connecter — implémenté |
| POST | `/api/v1/auth/refresh` | Renouveler une session — implémenté |
| POST | `/api/v1/auth/logout` | Révoquer une session — implémenté |
| GET | `/api/v1/me` | Consulter son profil — implémenté |
| POST | `/api/v1/agencies/{id}/invitations` | Inviter un membre — implémenté |
| PATCH | `/api/v1/agencies/{id}/members/{memberId}` | Modifier le rôle d'un membre |
| DELETE | `/api/v1/agencies/{id}/members/{memberId}` | Retirer un accès — implémenté |

Les chemins prévus peuvent évoluer. Leurs champs, formats de session, codes d'erreur et autorisations ne sont pas encore définis ; ne pas générer de formulaires ou de clients API en supposant leurs valeurs. Le cadrage prévoit plusieurs agences par utilisateur, une agence active validée côté serveur, la protection du dernier propriétaire et l'interdiction de s'attribuer soi-même un rôle supérieur.

Le domaine contient les premiers contrôles de membership (agence active, protection du dernier propriétaire et absence d'élévation personnelle). Les sessions disposent de tables PostgreSQL et d'une rotation conditionnelle testée en concurrence. Les sessions sont reliées aux endpoints décrits ci-dessus. Les changements de membres et les invitations sont autorisés et audités ; la soumission et l'approbation des agences restent à développer.
