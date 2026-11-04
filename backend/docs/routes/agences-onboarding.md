# Agences et onboarding — tranches 1 à 3 implémentées

Quinze routes sont disponibles : la création d'un brouillon (B2.1), l'état d'onboarding (B2.9), la lecture d'une agence, la complétion de l'identité (B2.2), la modification du profil (B2.6), les zones desservies (B2.3), les sites (B2.8) et l'activation et la suspension des capacités (B2.4, B2.7). La soumission arrive dans la tranche suivante du lot B2 ; ne pas supposer ses champs. Toutes les routes demandent `Authorization: Bearer <accessToken>` et répondent avec `Cache-Control: no-store`. Les erreurs utilisent Problem Details (voir [conventions](../conventions.md)).

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
| `capabilities` | Les capacités déjà activées au moins une fois, dans l'ordre `delivery`, `storage` : `{ "type": "delivery" \| "storage", "state": "active" \| "suspended", "since": "date ISO 8601 de la dernière transition", "reason": "motif de la suspension" \| null, "acceptsNewRequests": booléen }`. Une capacité jamais activée est absente. `acceptsNewRequests` est faux dès qu'elle est suspendue (le blocage effectif des demandes est vérifié au lot 4). |
| `hybrid` | Vrai si la livraison et le stockage sont tous deux actifs. |
| `activeZones`, `activeSites` | Nombres de zones desservies actives et de sites actifs. Les prérequis `active_capability` et `active_site` en sont dérivés. |

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

## Zones desservies

Une zone est une ville (2 à 80 caractères) et, facultativement, un quartier (2 à 80 caractères) ; sans quartier, elle couvre toute la ville. Le texte est libre, débarrassé des espaces de bord et des espaces multiples ; les caractères de contrôle sont refusés. Deux zones **actives** d'une agence ne peuvent pas être égales, sans tenir compte de la casse, des accents ni des espaces (`Douala / Akwa`, `douala / AKWA` et `Douala / Akwá` sont la même zone). Une agence dessert au plus **100 zones actives**. Zones, sites et capacités se gèrent en brouillon comme après la soumission, et ne changent pas la version de l'agence.

La zone desservie est **la même zone** que celle des grilles tarifaires du lot 3 (décision D-15) : son `id` est durable. Une zone n'est jamais supprimée : elle est **retirée** (`status: "retired"`, avec sa date), et l'ajouter de nouveau la réactive avec le même `id`.

Objet zone, renvoyé par les trois routes :

```json
{ "id": "uuid", "city": "Douala", "district": "Akwa", "status": "active", "addedAt": "date ISO 8601", "retiredAt": null }
```

### Ajouter une zone

`POST /api/v1/agencies/{agencyId}/zones` — propriétaire ou administrateur. Corps (aucun autre champ n'est accepté) :

```json
{ "city": "Douala", "district": "Akwa" }
```

`district` est facultatif (`null` ou absent : toute la ville). Réponse **201** : la zone, active. Ajouter une zone retirée renvoie 201 avec la zone d'origine, réactivée (même `id`).

| Statut | Cas |
| --- | --- |
| 201 | Zone ajoutée ou réactivée. |
| 400 | Champ inconnu, type incorrect, ville ou quartier hors bornes, `agencyId` non UUID. |
| 401 | Jeton absent, invalide ou session révoquée. |
| 403 | Le membre est un agent. |
| 404 | Agence inconnue, ou personne sans membership actif (même réponse). |
| 409 | `code: "ZONE_ALREADY_SERVED"` (zone active identique) ou `code: "ZONE_LIMIT_REACHED"` (100 zones actives ; la réactivation compte comme un ajout). |

### Retirer une zone

`DELETE /api/v1/agencies/{agencyId}/zones/{zoneId}` — propriétaire ou administrateur. Retrait **logique** : la zone reste listée avec `status: "retired"` et `retiredAt`. Réponse **200** : la zone retirée.

| Statut | Cas |
| --- | --- |
| 200 | Zone retirée. |
| 400 | `agencyId` ou `zoneId` non UUID. |
| 401, 403 | Comme ci-dessus. |
| 404 | Agence inconnue ou sans accès, **ou zone inconnue ou d'une autre agence** : même réponse. L'identifiant de zone n'est cherché que dans l'agence du chemin. |
| 409 | `code: "ZONE_ALREADY_RETIRED"`, ou `code: "LAST_ACTIVE_ZONE"` : c'est la dernière zone active et la livraison est active (suspendre la livraison ou ajouter une autre zone d'abord). Livraison inactive ou suspendue : le retrait est accepté. |

### Lister les zones

`GET /api/v1/agencies/{agencyId}/zones?limit=20&cursor=<nextCursor>` — **tout membre actif** (dont l'agent). Zones actives d'abord, puis retirées, chacune par ville, quartier puis identifiant. `limit` de 1 à 100 (20 par défaut), hors bornes : 400. `cursor` est le `nextCursor` de la page précédente (un UUID), sinon 400.

```json
{ "items": [ { "id": "uuid", "city": "Douala", "district": "Akwa", "status": "active", "addedAt": "…", "retiredAt": null } ], "nextCursor": "uuid" | null, "hasMore": true }
```

Non-membre, ancien membre, autre agence ou agence inconnue : même **404**.

## Sites

Un site a un nom (2 à 120 caractères, unique parmi les sites **actifs** de l'agence, sans tenir compte de la casse, des accents ni des espaces), une ville (2 à 80), une adresse (5 à 300) et un téléphone facultatif (mêmes règles que le téléphone principal : `+237` puis 9 chiffres commençant par 2 ou 6, espaces tolérés). Il porte sa **propre version**, distincte de celle de l'agence, et un statut `active` ou `inactive`. Un site n'est jamais supprimé.

Objet site :

```json
{ "id": "uuid", "name": "Agence Akwa", "city": "Douala", "address": "Rue Joss, face Total Akwa", "phone": "+237677123456", "status": "active", "createdAt": "…", "deactivatedAt": null, "version": 1 }
```

Les routes qui renvoient un site posent son `version` dans l'en-tête `ETag` (`"2"`), à renvoyer dans `If-Match` pour le modifier.

| Route | Rôles | Effet |
| --- | --- | --- |
| `POST /api/v1/agencies/{agencyId}/sites` | propriétaire, administrateur | Crée un site actif (version 1). Corps : `name`, `city`, `address` obligatoires, `phone` facultatif ; aucun autre champ. **201.** |
| `PATCH /api/v1/agencies/{agencyId}/sites/{siteId}` | propriétaire, administrateur | Modification **partielle** d'un site actif, avec `If-Match` = version du site (428 absent, 400 mal formé, 409 `STALE_SITE_VERSION` périmé). `name`, `city`, `address` ne se vident pas ; `phone: null` (ou texte vide) l'efface. Une demande sans changement réel réussit avec la version inchangée. **200.** |
| `POST /api/v1/agencies/{agencyId}/sites/{siteId}/deactivate` | propriétaire, administrateur | Désactive le site (conservé avec `deactivatedAt`). Sans corps. **200.** |
| `POST /api/v1/agencies/{agencyId}/sites/{siteId}/reactivate` | propriétaire, administrateur | Réactive un site désactivé. Sans corps. **200.** |
| `GET /api/v1/agencies/{agencyId}/sites?limit=20&cursor=…` | **tout membre actif** | Sites actifs d'abord, puis désactivés, par nom puis identifiant ; même pagination que les zones. |

| Statut | Cas |
| --- | --- |
| 400 | Champ inconnu ou invalide, `If-Match` mal formé, `limit` ou `cursor` invalide, identifiant non UUID. |
| 401, 403 | Comme pour les zones (agent : 403 sur toute écriture). |
| 404 | Agence inconnue ou sans accès, **ou site inconnu ou d'une autre agence** : même réponse. |
| 409 | `SITE_NAME_TAKEN` (création, renommage, ou réactivation alors qu'un site actif porte le nom), `SITE_DEACTIVATED` (modifier ou désactiver un site désactivé), `SITE_ALREADY_ACTIVE` (réactiver un site actif), `LAST_ACTIVE_SITE` (dernier site actif alors que le stockage est actif), `STALE_SITE_VERSION`. |
| 428 | `If-Match` absent (PATCH). |

## Activer et suspendre une capacité

Deux capacités existent : `delivery` (livraison) et `storage` (stockage). Une agence qui a les deux actives est **hybride** (`hybrid`, état dérivé). `{type}` vaut `delivery` ou `storage` ; toute autre valeur : 400.

Cycle de vie : *jamais activée* → `active` → `suspended` → `active`… L'historique complet (dates, auteurs, motifs) est conservé ; la réponse et l'état d'onboarding donnent l'état courant.

Réponse **200** des deux routes (les capacités déjà activées au moins une fois, dans l'ordre `delivery`, `storage`) :

```json
{ "capabilities": [ { "type": "delivery", "state": "active", "since": "date ISO 8601", "reason": null, "acceptsNewRequests": true } ], "hybrid": false }
```

### Activer

`POST /api/v1/agencies/{agencyId}/capabilities/{type}/activate` — propriétaire ou administrateur, sans corps (un corps non vide est refusé : 400). Sert aussi à **réactiver** une capacité suspendue, sous les mêmes conditions.

Configuration minimale (décision D-04) : **livraison** = au moins une zone active ; **stockage** = au moins un site actif.

| Statut | Cas |
| --- | --- |
| 200 | Capacité active. |
| 400 | `{type}` inconnu, corps non vide, `agencyId` non UUID ; ou `code: "CAPABILITY_PREREQUISITE_MISSING"` : le champ `missing` du Problem Details nomme ce qui manque (`["active_zone"]` ou `["active_site"]`). |
| 401, 403, 404 | Comme pour les zones. |
| 409 | `code: "CAPABILITY_ALREADY_ACTIVE"`. Aucun second effet, aucune seconde trace d'audit. |

### Suspendre

`POST /api/v1/agencies/{agencyId}/capabilities/{type}/suspend` — propriétaire ou administrateur. Corps (aucun autre champ) :

```json
{ "reason": "Inventaire annuel" }
```

`reason` : 3 à 500 caractères de texte brut, obligatoire. Une capacité suspendue n'accepte plus de nouvelles demandes (`acceptsNewRequests: false`) ; les demandes et commandes déjà acceptées ne sont pas concernées. Suspendre la dernière capacité active est permis et ne change pas le statut de l'agence.

| Statut | Cas |
| --- | --- |
| 200 | Capacité suspendue. |
| 400 | `{type}` inconnu, motif absent ou hors bornes, champ inconnu. |
| 401, 403, 404 | Comme pour les zones. |
| 409 | `code: "CAPABILITY_NOT_ACTIVE"` : déjà suspendue, ou jamais activée. Aucun second effet. |

### Invariants croisés

- Tant que la **livraison est active**, la dernière zone active ne peut pas être retirée (409 `LAST_ACTIVE_ZONE`).
- Tant que le **stockage est actif**, le dernier site actif ne peut pas être désactivé (409 `LAST_ACTIVE_SITE`).
- Suspendue, la capacité ne protège plus rien ; la réactiver revérifie la configuration minimale.
- Ces règles tiennent en concurrence : toutes les écritures de configuration d'une agence passent par le verrou de la ligne `agencies`, et la base garde des index uniques partiels (zones actives, noms de sites actifs) et la clé `(agence, capacité, numéro de transition)`. Deux activations simultanées ne produisent qu'une activation ; un retrait de la dernière zone et l'activation de la livraison simultanés : l'un des deux est refusé, jamais livraison active sans zone.

### Droits et audit

| Rôle dans l'agence | Lire zones, sites, état | Écrire zones, sites, capacités |
| --- | --- | --- |
| `owner`, `admin` | oui | oui |
| `agent` | oui | 403 |
| non-membre, ancien membre, autre agence, agence inconnue | 404 | 404 (même réponse) |

L'agence visée vient du chemin, jamais du corps. Chaque action effective écrit une trace d'audit dans la même transaction (`agency.zone_added`, `agency.zone_reactivated`, `agency.zone_retired`, `agency.site_created`, `agency.site_updated`, `agency.site_deactivated`, `agency.site_reactivated`, `agency.capability_enabled`, `agency.capability_suspended`), avec des **noms** de champs ou de capacités seulement (`details.fields`), jamais de villes, d'adresses, de téléphones ni de motifs. Un refus (conflit, droit, donnée invalide) et une modification sans effet réel n'écrivent rien.
