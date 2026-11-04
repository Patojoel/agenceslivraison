# Agences et onboarding — tranche 1 implémentée

Deux routes sont disponibles pour l'instant : la création d'un brouillon d'agence (B2.1) et la consultation de l'état d'onboarding (B2.9). L'identité, les zones, les capacités, les sites et la soumission arrivent dans les tranches suivantes du lot B2 ; ne pas supposer leurs champs. Les deux routes demandent `Authorization: Bearer <accessToken>` et répondent avec `Cache-Control: no-store`. Les erreurs utilisent Problem Details (voir [conventions](../conventions.md)).

## Créer un brouillon d'agence

`POST /api/v1/agencies`

Toute personne connectée (compte `individual` ou `merchant`) peut créer une agence. L'agence naît au statut `draft` et la personne en devient **propriétaire actif** dans la même transaction ; une trace d'audit `agency.created` est écrite. Une personne peut posséder plusieurs agences. La nouvelle agence apparaît aussitôt dans `GET /api/v1/me/agencies` avec le rôle `owner`.

En-tête facultatif : `Idempotency-Key`, de 8 à 128 caractères ASCII visibles (sans espace). Elle est propre à l'utilisateur authentifié.

Corps (aucun autre champ n'est accepté, notamment ni `status`, ni `agencyId`, ni rôle) :

```json
{ "tradeName": "  Express Douala " }
```

`tradeName` est débarrassé de ses espaces de bord ; il compte de 2 à 120 caractères.

Réponse **201** :

```json
{ "agencyId": "uuid", "tradeName": "Express Douala", "status": "draft", "role": "owner" }
```

| Statut | Cas |
| --- | --- |
| 201 | Agence créée, ou rejeu idempotent (même réponse, aucune seconde agence, aucune seconde trace d'audit). |
| 400 | Champ inconnu, `tradeName` absent, non textuel ou hors bornes, `Idempotency-Key` mal formée. Le corps ne détaille pas les champs. |
| 401 | Jeton absent, invalide, expiré ou session révoquée. |
| 409 | `Idempotency-Key` déjà utilisée par cette personne pour un autre `tradeName`. |
| 429 | Plus de 30 requêtes par adresse client et par minute sur une instance. |
| 503 | Base ou migrations indisponibles. |

Idempotence :

- Même clé et même contenu : la même agence est renvoyée. Le rejeu renvoie la réponse de création (`status: "draft"`, `role: "owner"`), même si l'agence a évolué depuis.
- Deux requêtes simultanées avec la même clé et le même contenu produisent une seule agence ; les deux réponses désignent la même `agencyId`.
- Sans `Idempotency-Key`, chaque envoi crée une agence, même avec le même nom.
- Les clés ne sont pas encore purgées.

## Consulter l'état d'onboarding

`GET /api/v1/agencies/{agencyId}/onboarding`

Lisible par tout **membre actif** de l'agence (`owner`, `admin`, `agent`). Un non-membre, un ancien membre, une autre agence ou une agence inexistante reçoivent le même **404**. Un `agencyId` qui n'est pas un UUID reçoit **400**. Lecture seule : aucune écriture ni trace d'audit.

Réponse **200** :

```json
{
  "status": "draft",
  "submission": null,
  "prerequisites": [
    { "code": "legal_name", "filled": false },
    { "code": "headquarters_city", "filled": false },
    { "code": "headquarters_address", "filled": false },
    { "code": "primary_phone", "filled": false },
    { "code": "active_capability", "filled": false },
    { "code": "active_site", "filled": false }
  ],
  "readyForSubmission": false,
  "capabilities": [],
  "hybrid": false,
  "activeZones": 0,
  "activeSites": 0
}
```

| Champ | Sens |
| --- | --- |
| `status` | `draft` ou `submitted` (soumise à vérification). Un brouillon le reste sans limite de durée. |
| `submission` | `null` pour un brouillon ; `{ "submittedAt": "date ISO 8601", "submittedBy": "uuid" }` pour une agence soumise. |
| `prerequisites` | Les six prérequis de soumission, toujours dans cet ordre, avec `filled` vrai ou faux. Les valeurs de l'identité ne sont jamais renvoyées. Règle provisoire (D-04) : raison sociale, ville et adresse du siège, téléphone principal, une capacité active, un site actif. |
| `readyForSubmission` | Vrai seulement pour un brouillon dont tous les prérequis sont remplis. Toujours faux pour une agence soumise. |
| `capabilities` | Capacités de l'agence : `{ "type": "delivery" \| "storage", "state": "active" \| "suspended", "since": "date ISO 8601", "reason": "texte" \| null, "acceptsNewRequests": booléen }`. Vide tant que l'activation des capacités n'est pas livrée. |
| `hybrid` | Vrai si la livraison et le stockage sont tous deux actifs. |
| `activeZones`, `activeSites` | Nombres de zones desservies et de sites actifs. Valent 0 tant que ces fonctions ne sont pas livrées. |

Aucun champ ne dit qu'une agence est « vérifiée », « certifiée » ou « assurée » : une agence soumise est seulement « soumise à vérification ».

| Statut | Cas |
| --- | --- |
| 200 | État renvoyé. |
| 400 | `agencyId` n'est pas un UUID. |
| 401 | Jeton absent, invalide ou session révoquée. |
| 404 | Agence inconnue, ou personne sans membership actif dans l'agence. |
| 503 | Base ou migrations indisponibles. |
