# Agences et onboarding — tranches 1 et 2 implémentées

Cinq routes sont disponibles : la création d'un brouillon (B2.1), l'état d'onboarding (B2.9), la lecture d'une agence, la complétion de l'identité (B2.2) et la modification du profil (B2.6). Les zones, les capacités, les sites et la soumission arrivent dans les tranches suivantes du lot B2 ; ne pas supposer leurs champs. Toutes les routes demandent `Authorization: Bearer <accessToken>` et répondent avec `Cache-Control: no-store`. Les erreurs utilisent Problem Details (voir [conventions](../conventions.md)).

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

## Lire une agence

`GET /api/v1/agencies/{agencyId}`

Lisible par tout **membre actif** (`owner`, `admin`, `agent`) ; non-membre, ancien membre, autre agence et agence inexistante reçoivent le même **404**. `agencyId` non UUID : 400. Lecture seule. La réponse porte la version dans le corps et dans l'en-tête `ETag` (`"3"`) : c'est la valeur à renvoyer dans `If-Match` pour modifier.

```json
{
  "id": "uuid", "status": "draft", "tradeName": "Express Douala", "description": null, "version": 3,
  "identity": {
    "legalName": "Express Douala SARL", "headquartersCity": "Douala", "headquartersAddress": "Rue Joss, face pharmacie",
    "primaryPhone": "+237677123456", "contactEmail": null, "rccm": null, "niu": null
  }
}
```

Un champ non renseigné vaut `null`. Ce sont des données professionnelles de l'agence, réservées à ses membres (non publiées avant B3). Statuts : 200, 400, 401, 404, 503.

## Compléter l'identité

`PATCH /api/v1/agencies/{agencyId}/identity` — **brouillon uniquement**, propriétaire ou administrateur.

En-tête obligatoire : `If-Match` (version lue, `3` ou `"3"` ; voir [Concurrence optimiste](../conventions.md#concurrence-optimiste--etag-et-if-match)).

Corps : mise à jour **partielle** ; un champ absent reste inchangé. Aucun autre champ n'est accepté (ni `status`, ni `version`, ni `agencyId`, ni les champs du profil).

| Champ | Exigé pour soumettre | Règle |
| --- | --- | --- |
| `legalName` | oui | 2 à 200 caractères |
| `headquartersCity` | oui | 2 à 80 caractères, texte libre |
| `headquartersAddress` | oui | 5 à 300 caractères |
| `primaryPhone` | oui | `+237` puis 9 chiffres commençant par 2 ou 6 ; les espaces sont tolérés et `+237` est facultatif à la saisie : `6 77 12 34 56` donne `+237677123456`. Les numéros étrangers sont refusés. |
| `contactEmail` | non | adresse valide, passée en minuscules ; `null` ou texte vide pour l'effacer |
| `rccm` | non | 5 à 40 caractères ; `null` ou texte vide pour l'effacer |
| `niu` | non | 14 caractères alphanumériques ; `null` ou texte vide pour l'effacer |

Les textes sont comptés en caractères, débarrassés des espaces de bord (et, hors description, des espaces multiples) ; les caractères de contrôle (dont NUL) sont refusés. Les quatre champs exigés ne peuvent pas être vidés. Une valeur identique à celle déjà enregistrée n'est pas un changement.

Réponse **200** (en-tête `ETag` = nouvelle version) :

```json
{ "version": 4, "identity": { "legalName": "Express Douala SARL", "headquartersCity": "Douala", "headquartersAddress": null, "primaryPhone": "+237677123456", "contactEmail": null, "rccm": null, "niu": null } }
```

Une demande qui ne change aucune valeur (ou un corps `{}`) réussit avec la version inchangée, sans écriture ni audit. Chaque modification effective incrémente la version et écrit l'audit `agency.identity_updated` avec les **noms** des champs modifiés, jamais leurs valeurs.

| Statut | Cas |
| --- | --- |
| 200 | Identité enregistrée (ou rien à changer). |
| 400 | Champ inconnu, type incorrect, valeur hors règle, `If-Match` mal formé, `agencyId` non UUID. Le corps ne détaille pas les champs. |
| 401 | Jeton absent, invalide ou session révoquée. |
| 403 | Le membre est un agent. |
| 404 | Agence inconnue, ou personne sans membership actif (même réponse). |
| 409 | Agence soumise (identité verrouillée), ou version périmée. Rien n'est écrit. |
| 428 | `If-Match` absent. |
| 503 | Base ou migrations indisponibles. |

L'état d'onboarding reflète aussitôt les quatre prérequis d'identité (`legal_name`, `headquarters_city`, `headquarters_address`, `primary_phone`) ; l'e-mail, le RCCM et le NIU ne sont pas exigés.

## Modifier le profil

`PATCH /api/v1/agencies/{agencyId}/profile` — **brouillon ou soumise**, propriétaire ou administrateur. Mêmes en-têtes, mêmes droits, mêmes codes que l'identité.

Corps partiel : `tradeName` (2 à 120 caractères, jamais vide ni `null`) et/ou `description` (1 à 1 000 caractères de texte brut ; `null` ou texte vide pour l'effacer). Tout autre champ, y compris un champ d'identité, est refusé (400). La description est du **texte** : le balisage saisi est conservé tel quel et n'est jamais interprété ; le client doit l'échapper à l'affichage.

Réponse **200** (en-tête `ETag` = nouvelle version) :

```json
{ "version": 5, "tradeName": "Express Douala & Littoral", "description": "Livraison express dans Douala, 7j/7" }
```

Audit `agency.profile_updated` (noms de champs seulement). Le profil reste modifiable après la soumission, sans changer le statut. Le 409 ne couvre ici que la version périmée.

## Droits et isolation (identité et profil)

| Rôle dans l'agence | Lire | Modifier identité et profil |
| --- | --- | --- |
| `owner`, `admin` | oui | oui |
| `agent` | oui | 403 |
| non-membre, ancien membre, autre agence, agence inconnue | 404 | 404 (même réponse) |

L'agence visée vient du chemin et n'est jamais lue dans le corps ; le membership est vérifié sous le verrou de la ligne de l'agence.
