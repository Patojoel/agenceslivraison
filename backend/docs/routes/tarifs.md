# Tarifs et devis — lot B3, tranches 2 et 3

Ce fichier couvre la grille de livraison et la simulation (tranche 2), puis les devis (tranche 3, section « Devis » en fin de fichier).

## Grille de livraison et simulation (tranche 2)

Six routes sont disponibles : la création de la grille de livraison d'une agence (B3.4), la publication d'une nouvelle version (B3.5), la lecture de la grille, de son historique et d'une version (B3.14), et la simulation d'un prix (B3.6). Elles complètent les zones de [Agences et onboarding](agences-onboarding.md) : la zone desservie d'une agence est la zone tarifaire (décision D-15), sans route de zone propre au module `pricing` (B3.1 et B3.3 n'ajoutent que les effets décrits plus bas). Toutes demandent `Authorization: Bearer <accessToken>` et répondent avec `Cache-Control: no-store`. Les erreurs utilisent Problem Details (voir [conventions](../conventions.md)).

Règles de la décision D-05 (hypothèses devenues décisions) : une grille de livraison par agence ; des **tranches de poids** par zone de destination (borne supérieure **incluse**), sans distance ni origine ; un poids volumétrique facultatif (diviseur de 1 000 à 10 000, dimensions en centimètres) ; des prix en **francs CFA (XAF) entiers de 1 à 10 000 000, taxes comprises**, aucun calcul de taxe ; poids taxable arrondi au gramme supérieur, total égal à la somme exacte des prix des colis ; une version s'applique immédiatement ; pas de tarif de stockage.

## Droits

| Action | Propriétaire | Administrateur | Agent | Ancien membre, autre agence, agence inconnue | Non connecté |
| --- | --- | --- | --- | --- | --- |
| Créer la grille, publier une version | oui | oui | 403 | 404 | 401 |
| Lire la grille, l'historique, une version ; simuler un prix | oui | oui | oui | 404 | 401 |

L'agence vient du chemin et le rôle du membership actif de l'appelant, jamais du corps. Ces droits sont décidés dans `pricing` (`application/pricing-rights.ts`, tables exhaustives par rôle). Une zone d'une autre agence est « introuvable » comme une zone inconnue (même réponse).

## Corps d'une grille

Le même corps sert à la création et à chaque nouvelle version : c'est le **barème complet**.

```json
{
  "currency": "XAF",
  "volumetricDivisor": 5000,
  "lines": [
    { "zoneId": "uuid", "tiers": [{ "upTo": "1 kg", "price": 1000 }, { "upTo": "5 kg", "price": 1500 }] }
  ]
}
```

- `currency` est facultatif et ne peut valoir que `XAF`. `volumetricDivisor` est facultatif (entier de 1 000 à 10 000, ou `null`).
- `lines` : de 1 à 100 zones, **une ligne par zone**, chaque zone étant une zone **active** de l'agence. Une zone active absente du barème est « sans tarif ».
- `tiers` : de 1 à 20 tranches par zone, **bornes strictement croissantes**. `upTo` est un poids **avec son unité explicite** (`kg` ou `g`, virgule ou point décimal), au gramme près, de 1 g à 1 000 kg : `"1 kg"`, `"1000 g"` et `"1,0 kg"` sont la même borne ; `"1"`, `"1 lb"`, `"0,5 g"` et `"1001 kg"` sont refusés. `price` est un nombre entier de francs de 1 à 10 000 000.
- Aucun autre champ n'est accepté (400).

Une version, une fois écrite, n'est **jamais modifiée** : les prix d'une zone retirée restent dans les versions existantes et s'appliquent de nouveau si la zone est réactivée.

## Créer la grille

`POST /api/v1/agencies/{agencyId}/rate-card`

Crée la grille et sa **version 1**, en vigueur aussitôt ; propriétaire ou administrateur. L'agence peut être en brouillon et sans capacité de livraison active : on prépare ses prix pendant l'onboarding. Réponse **201**, avec l'en-tête `ETag: "1"` :

```json
{
  "id": "uuid",
  "version": {
    "number": 1, "createdAt": "2026-11-04T10:00:00.000Z", "createdBy": "uuid", "volumetricDivisor": null, "currency": "XAF",
    "zones": [
      { "zoneId": "uuid", "city": "Douala", "district": "Akwa", "zoneStatus": "active",
        "tiers": [{ "upToGrams": 1000, "price": 1000 }, { "upToGrams": 5000, "price": 1500 }] }
    ]
  }
}
```

`city` et `district` sont le libellé actuel de la zone ; `zoneStatus` vaut `active` ou `retired`. Les tranches sont exprimées en grammes.

| Statut | Cas |
| --- | --- |
| 201 | Grille créée. |
| 400 | Champ inconnu, devise autre que `XAF`, unité absente ou inconnue, borne hors limites, bornes non croissantes, prix hors règle, diviseur hors limites, zone sur deux lignes, trop de zones ou de tranches, identifiant mal formé. Le corps ne détaille pas les champs. |
| 401 | Jeton absent, invalide, expiré ou session révoquée. |
| 403 | Agent. |
| 404 | Agence inconnue, ancien membre ou autre agence ; zone inconnue ou d'une autre agence. |
| 409 | `RATE_CARD_ALREADY_EXISTS` : l'agence a déjà une grille (on publie une version). `ZONE_RETIRED` : une zone du barème est retirée. De deux créations simultanées, une seule réussit. |

## Publier une nouvelle version

`POST /api/v1/agencies/{agencyId}/rate-card/versions`

Publie le barème complet comme version suivante, en vigueur aussitôt ; propriétaire ou administrateur. La version précédente reste intacte et consultable. **En-tête obligatoire** : `If-Match` = numéro de la version en vigueur sur laquelle l'auteur s'appuie, nu (`3`) ou entre guillemets (`"3"`).

- **201** avec la nouvelle version (même forme que la création) et `ETag` du nouveau numéro.
- **200**, sans rien écrire (aucune version, aucune trace d'audit), si le barème est identique à celui en vigueur (l'ordre des zones ne compte pas) ; la réponse est la version en vigueur.

| Statut | Cas |
| --- | --- |
| 400 | Barème invalide (comme la création) ; `If-Match` mal formé (étiquette faible `W/"3"`, liste, `*`, zéro, négatif, trop grand). |
| 401, 403 | Comme la création. |
| 404 | Agence inconnue, ancien membre ou autre agence ; **agence sans grille** ; zone inconnue ou d'une autre agence. |
| 409 | `STALE_RATE_CARD_VERSION` : le numéro de base n'est plus la version en vigueur (rien n'est écrit). `ZONE_RETIRED` : une zone du barème est retirée. De deux versions simultanées fondées sur la même, une seule réussit. |
| 428 | `If-Match` absent. |

Publier et retirer une zone sont sérialisés : une version n'est jamais écrite pour une zone déjà retirée.

## Lire la grille

`GET /api/v1/agencies/{agencyId}/rate-card` : la version en vigueur et ses lignes, pour tout membre actif ; `ETag` = son numéro. **404** si l'agence n'a pas encore de grille. Une zone retirée depuis reste présente avec `zoneStatus: "retired"` et ses tranches.

`GET /api/v1/agencies/{agencyId}/rate-card/versions/{number}` : une version telle qu'elle a été écrite (même forme), pour tout membre actif. 400 si `number` n'est pas un entier de 1 à 999 999 999 ; 404 si la version n'existe pas.

## Historique des versions

`GET /api/v1/agencies/{agencyId}/rate-card/versions?limit=&cursor=`

De la plus récente à la plus ancienne, pour tout membre actif. `limit` de 1 à 50 (20 par défaut) ; `cursor` est la valeur `nextCursor` de la page précédente (le numéro de sa dernière version). Réponse `{ items, nextCursor, hasMore }` ; chaque élément est un résumé, le barème se lit par la route de la version :

```json
{ "items": [{ "number": 3, "createdAt": "…", "createdBy": "uuid", "volumetricDivisor": null, "zoneCount": 2 }], "nextCursor": "3", "hasMore": true }
```

400 si `limit` ou `cursor` est invalide ; 404 si l'agence n'a pas de grille.

## Simuler un prix

`POST /api/v1/agencies/{agencyId}/quotes/preview`

Tout membre actif. Lecture pure : **rien n'est enregistré** (ni devis, ni trace d'audit) et aucun verrou n'est pris. Utilise la version en vigueur au moment du calcul.

```json
{ "zoneId": "uuid", "parcels": [{ "weight": "0,8 kg" }, { "weight": "0,5 kg", "dimensions": { "length": 30, "width": 20, "height": 10, "unit": "cm" } }] }
```

- `parcels` : de 1 à 20 colis. `weight` avec son unité explicite (`kg` ou `g`), de plus de 0 à 1 000 kg ; une précision inférieure au gramme est arrondie au gramme supérieur. `dimensions` : les trois valeurs entières de 1 à 500 et l'unité `cm`, ou rien.
- Poids taxable = poids réel, ou le plus grand du poids réel et de `longueur × largeur × hauteur ÷ diviseur` (en kg) si la version a un diviseur et que le colis a ses dimensions, arrondi au gramme supérieur. Prix = celui de la première tranche dont la borne est supérieure ou égale au poids taxable.

Réponse **200** :

```json
{
  "currency": "XAF", "indicative": true, "notice": "prix indicatif, non garanti sans devis",
  "status": "priced", "version": 1, "zoneId": "uuid",
  "parcels": [{ "taxableGrams": 800, "price": 1000 }], "total": 1000
}
```

| `status` | Sens |
| --- | --- |
| `priced` | Tous les colis sont dans le barème ; `total` est la somme exacte. |
| `out_of_scale` | Au moins un colis dépasse la dernière borne : son `price` vaut `null`, `total` vaut `null` (pas de total partiel). |
| `no_tariff` | La zone n'a aucune ligne dans la version en vigueur, ou l'agence n'a pas de grille (`version: null`) : `parcels` est vide, `total` vaut `null`. Ce n'est pas une erreur. |

| Statut | Cas |
| --- | --- |
| 400 | Poids sans unité, hors bornes, dimensions incomplètes ou sans unité `cm`, nombre de colis hors de 1 à 20, champ inconnu. Vérifié même si l'agence n'a pas de grille. |
| 401 | Jeton absent ou invalide. |
| 404 | Agence inconnue, ancien membre ou autre agence ; zone inconnue ou d'une autre agence. |
| 409 | `ZONE_RETIRED` : une zone retirée ne peut plus être chiffrée. |

## Effets des zones (B3.1 et B3.3)

- Une zone ajoutée par `POST /agencies/{agencyId}/zones` est aussitôt tarifable ; tant qu'aucune version ne la couvre, elle est « sans tarif » (`no_tariff`).
- Une zone retirée ne peut plus être chiffrée (409 `ZONE_RETIRED`) ni figurer dans une nouvelle version ; ses lignes sont conservées dans toutes les versions, et si la zone est réactivée (même identifiant), la ligne de la version en vigueur s'applique de nouveau.
- Les zones et les grilles de deux agences ne se mélangent jamais : en base, une ligne de grille cite `(agency_id, zone_id)` de `service_zones` par clé étrangère composite.

## Audit

Chaque création et chaque version effective écrit une ligne dans `identity_audit` : `pricing.rate_card_created` ou `pricing.rate_card_versioned`, l'auteur, l'agence, `resource_id` = identifiant de la grille et `details = { "fields": ["version:2"] }`. Aucun prix, poids ni zone n'y figure. Les refus, les publications sans changement et les simulations n'écrivent rien.

Le numéro de version est rangé dans `details.fields` sous la forme `version:<n>` : c'est la forme des lignes déjà écrites, et l'historique d'audit n'est jamais réécrit ; la changer scinderait l'historique en deux formats sans bénéfice (aucun consommateur ne l'interprète).

# Devis — lot B3, tranche 3 (émission, acceptation, lecture)

Quatre routes sous `/api/v1/agencies/{agencyId}/quotes` (B3.7, B3.8, B3.15). Un devis est un **prix promis à un destinataire pour sept jours** : il est écrit une fois avec une **copie complète du calcul** (numéro de la version de grille utilisée, libellé de la zone, colis avec poids saisis et poids taxables, prix par colis, total) et ne suit plus jamais la grille ni la zone. Accepter un devis fige le prix ; il ne crée **aucune commande** (lot 5) et n'envoie rien au client. Toutes les routes demandent `Authorization: Bearer <accessToken>` et répondent avec `Cache-Control: no-store` : un devis porte le nom et le téléphone de son destinataire, donnée privée de l'agence.

## Droits des devis

| Action | Propriétaire | Administrateur | Agent | Ancien membre, autre agence, agence inconnue | Non connecté |
| --- | --- | --- | --- | --- | --- |
| Émettre un devis, enregistrer son acceptation | oui | oui | oui (décision D-22) | 404 | 401 |
| Lire un devis, lister les devis | oui | oui | oui | 404 | 401 |

Décidés dans `pricing` (`application/pricing-rights.ts`, `mayIssueQuotes`, table exhaustive par rôle). L'agence vient du chemin, l'auteur de la session. Un devis est cherché **dans l'agence du chemin seulement** : l'identifiant d'un devis d'une autre agence donne la même réponse 404 qu'un identifiant inconnu.

## Émettre un devis

`POST /api/v1/agencies/{agencyId}/quotes` — en-tête facultatif `Idempotency-Key` (8 à 128 caractères ASCII visibles).

```json
{
  "recipient": { "name": "Jean Kamga", "phone": "+237 699 00 11 22" },
  "zoneId": "uuid",
  "parcels": [{ "weight": "0,8 kg" }, { "weight": "3 kg" }],
  "manualPrice": { "price": 2000, "reason": "client régulier" }
}
```

- `recipient.name` : de 2 à 120 caractères, sans caractère de contrôle, de format (marques bidirectionnelles, largeur nulle) ni saut de ligne. `recipient.phone` : facultatif, `+237` puis 9 chiffres commençant par 2 ou 6 (les espaces sont acceptés, le numéro est enregistré sans espace). Le destinataire n'a pas de compte : le rattachement à un client d'agence arrive en B4.
- `zoneId` et `parcels` : comme la simulation (de 1 à 20 colis, poids avec unité, dimensions facultatives).
- `manualPrice` : facultatif, `price` entier de 1 à 10 000 000 XAF et `reason` de 3 à 300 caractères (les deux, ou rien). Il remplace le prix calculé ; **le prix calculé est conservé** à côté. Il est indispensable quand aucun prix ne peut être calculé (colis hors barème, zone sans tarif, agence sans grille) : sinon 400 `QUOTE_NOT_PRICEABLE`.
- Le prix calculé utilise **exactement le calcul de la simulation**, avec la version de la grille en vigueur à l'émission.
- Validité : sept jours à partir de l'émission, borne incluse (`validUntil`). Référence : `DEV-AAAA-NNNNNN`, croissante et sans trou par agence et par année (compteur verrouillé, unique `(agency_id, reference)`).

Réponse **201** (**200** pour un rejeu d'`Idempotency-Key`) : le devis complet.

```json
{
  "id": "uuid", "reference": "DEV-2026-000001", "status": "issued",
  "recipient": { "name": "Jean Kamga", "phone": "+237699001122" },
  "zone": { "id": "uuid", "city": "Douala", "district": "Akwa" },
  "parcels": [{ "weightGrams": 800, "dimensions": null, "taxableGrams": 800, "price": 1000 }],
  "currency": "XAF", "rateCardVersion": 1, "pricing": "priced",
  "calculatedTotal": 2500, "manualPrice": null, "manualPriceReason": null, "total": 2500,
  "issuedAt": "2026-11-10T09:00:00.000Z", "issuedBy": "uuid", "validUntil": "2026-11-17T09:00:00.000Z",
  "acceptedAt": null, "acceptedBy": null
}
```

| Champ | Sens |
| --- | --- |
| `pricing` | `priced` : tous les colis sont dans le barème ; `out_of_scale` : un colis au moins était hors barème (`price` `null`, `calculatedTotal` `null`) ; `no_tariff` : la zone n'avait pas de ligne ou l'agence pas de grille (`rateCardVersion` `null` dans ce dernier cas, `taxableGrams` `null`). |
| `total` | Ce à quoi le devis engage l'agence : `manualPrice` s'il y en a un, `calculatedTotal` sinon. |
| `status` | `issued`, `accepted` ou `expired`. **`expired` est dérivé** de `validUntil` et de l'horloge : il n'est jamais écrit. À `validUntil` exactement, le devis est encore valable ; une milliseconde plus tard, il est expiré. |

**Idempotence** : même clé et même contenu (destinataire, zone, colis, prix retenu) pour le même utilisateur et la même agence → le devis d'origine (200), rien n'est écrit, aucune référence consommée ; même clé et contenu différent → 409 `IDEMPOTENCY_KEY_REUSED` ; envois simultanés avec une clé → un seul devis.

| Statut | Cas |
| --- | --- |
| 400 | Corps invalide (champ inconnu, destinataire, poids, dimensions, prix retenu ou motif invalides) ; `QUOTE_NOT_PRICEABLE` ; `Idempotency-Key` mal formée. |
| 401 | Jeton absent ou invalide. |
| 404 | Agence inconnue, ancien membre ou autre agence ; zone inconnue ou d'une autre agence. |
| 409 | `ZONE_RETIRED` ; `DELIVERY_NOT_ACTIVE` (la capacité de livraison n'est pas active : jamais activée ou suspendue) ; `IDEMPOTENCY_KEY_REUSED`. |

## Accepter un devis

`POST /api/v1/agencies/{agencyId}/quotes/{quoteId}/accept` — action **sans contenu** (un corps non vide : 400).

Enregistre, au nom du destinataire qui a donné son accord hors plateforme, qu'il accepte : `status` passe à `accepted`, `acceptedAt` et `acceptedBy` sont renseignés, le prix est figé définitivement. Réponse **200** : le devis complet.

| Statut | Cas |
| --- | --- |
| 400 | Identifiant invalide, corps non vide. |
| 401 | Jeton absent ou invalide. |
| 404 | Agence inconnue, ancien membre ou autre agence ; devis inconnu ou d'une autre agence. |
| 409 | `QUOTE_ALREADY_ACCEPTED` (un second envoi n'a aucun effet : l'auteur reste le premier) ; `QUOTE_EXPIRED` ; `ZONE_RETIRED` (la zone du devis a été retirée depuis l'émission) ; `DELIVERY_NOT_ACTIVE` (livraison suspendue depuis l'émission). |

Concurrence : le rôle est contrôlé sans verrou, puis l'agence est verrouillée en partage (un retrait de zone, qui la verrouille en exclusif, est sérialisé avec l'acceptation : jamais d'acceptation sur une zone retirée avant la prise du verrou), puis le devis est verrouillé (`FOR UPDATE`) et mis à jour seulement `WHERE status = 'issued'` : de deux acceptations simultanées, une seule réussit. Ordre des verrous identique partout : `agencies`, puis `quotes`.

## Lire et lister les devis

`GET /api/v1/agencies/{agencyId}/quotes/{quoteId}` : le devis complet (200), 404 si inconnu ou d'une autre agence.

`GET /api/v1/agencies/{agencyId}/quotes?limit=20&cursor=…` : les devis de l'agence, **du plus récent au plus ancien**, `{ items, nextCursor, hasMore }`. `limit` de 1 à 100 (20 par défaut) ; `cursor` = le `nextCursor` de la page précédente, opaque (invalide : 400). Chaque élément est un résumé : `id`, `reference`, `status`, `recipientName`, `zone` (`id`, `city`, `district`), `currency`, `total`, `issuedAt`, `validUntil`, `acceptedAt` ; le détail et le téléphone se lisent par la route du devis. Pagination par clé `(issued_at, id)` sur l'index `quotes_agency_issued_at_id_idx`, parcouru à l'envers sans tri.

## Audit des devis

`pricing.quote_issued` et `pricing.quote_accepted` : l'auteur, l'agence et `resource_id` = identifiant du devis, **rien d'autre** (`details` vide) : ni destinataire, ni téléphone, ni montant, ni zone. Les refus, les rejeux d'`Idempotency-Key` et les lectures n'écrivent rien.
