# Marketplace — fiche publique de l'agence et annuaire public — lot B3, tranches 4 et 5

Deux familles de routes. **Privées (tranche 4)**, sous l'agence : publier la fiche (B3.9), la retirer, et lire son état ; elles alimentent la projection que l'annuaire lit. **Publiques (tranche 5, plus bas)** : `GET /public/agencies` et `GET /public/agencies/{slug}` (B3.10 à B3.13), sans authentification. Les trois routes privées demandent `Authorization: Bearer <jeton d'accès>` et répondent `Cache-Control: no-store` ; les erreurs sont en `application/problem+json`. Préfixe `/api/v1`.

Règles : décisions D-05 (une agence est publiable dès qu'elle est **soumise**, avec la mention « non vérifiée » jusqu'à l'approbation de B10) et D-23 (liste fermée de ce que la fiche contient).

## Droits

| Action | Propriétaire | Administrateur | Agent | Ancien membre, autre agence, agence inconnue | Non connecté |
| --- | --- | --- | --- | --- | --- |
| Publier, retirer | oui | 403 | 403 | 404 | 401 |
| Lire l'état de la fiche | oui | oui | oui | 404 | 401 |

L'agence vient du chemin et le rôle du membership actif de l'appelant, jamais du corps. Les droits sont décidés dans `marketplace` (`application/marketplace-rights.ts`, tables exhaustives par rôle). Le rôle est vérifié **avant** de verrouiller l'agence : une personne refusée est répondue sans attendre.

## Routes

| Méthode | Chemin | Corps | Succès |
| --- | --- | --- | --- |
| `POST` | `/agencies/{agencyId}/public-profile/publish` | aucun (tout corps non vide : 400) | 200, l'état |
| `POST` | `/agencies/{agencyId}/public-profile/unpublish` | aucun | 200, l'état |
| `GET` | `/agencies/{agencyId}/public-profile` | — | 200, l'état |

### L'état de la fiche

```json
{
  "published": true,
  "slug": "express-douala",
  "publishedAt": "2026-11-12T09:30:00.000Z",
  "unpublishedAt": null,
  "visible": true,
  "verification": "unverified",
  "obstacles": []
}
```

- `published` : le propriétaire a publié et n'a pas retiré. `visible` : publiée **et** sans obstacle, c'est-à-dire ce qu'un visiteur pourra trouver. Une fiche publiée peut être **masquée** sans être retirée : elle réapparaît dès que l'obstacle disparaît.
- `slug` : adresse publique, calculée à la première publication depuis le nom commercial (minuscules, sans accents, mots séparés par `-`, 3 à 80 caractères ; suffixe `-2`, `-3`… en cas de collision). Elle est **stable** (un changement de nom ne la modifie pas) et **jamais réattribuée**, même après un retrait. `null` tant que rien n'a été publié.
- `verification` : toujours `unverified` (« non vérifiée ») jusqu'à l'approbation par l'administration de la plateforme (B10) ; jamais « garantie », « assurée » ni « certifiée ».
- `obstacles` : ce qui masque la fiche publiée ou empêche d'en publier une, parmi `agency_not_submitted`, `provisional_trade_name`, `trade_name_not_publishable`, `no_active_capability`.

## Conflits (409)

| `code` | Cas |
| --- | --- |
| `AGENCY_NOT_SUBMITTED` | l'agence est encore au brouillon |
| `PROVISIONAL_TRADE_NAME` | l'agence porte le nom provisoire de la migration (« Agence » + espace + 8 premiers caractères de son identifiant) : le changer par `PATCH /agencies/{id}/profile` |
| `TRADE_NAME_NOT_PUBLISHABLE` | le nom contient un caractère de contrôle ou de format (bidi, largeur nulle…) ou aucune adresse de 3 caractères n'en peut être tirée |
| `NO_ACTIVE_CAPABILITY` | aucune capacité active (livraison ou stockage) |
| `PROFILE_ALREADY_PUBLISHED` | publication d'une fiche déjà publiée ; sans second effet, la date reste celle de la première |
| `PROFILE_NOT_PUBLISHED` | retrait d'une fiche non publiée ou jamais publiée |
| `PUBLIC_SLUG_UNAVAILABLE` | plus d'une cinquantaine d'agences homonymes : aucune adresse libre |

Les droits sont contrôlés avant l'état : l'administrateur et l'agent reçoivent 403 même sur une fiche déjà publiée. Deux publications simultanées de la même agence n'en retiennent qu'une (200 et 409), une seule trace d'audit ; deux agences homonymes publiées en même temps reçoivent deux adresses distinctes.

## Ce que la fiche contiendra

La projection `public_agency_listings` (lue par les routes publiques décrites plus bas) ne contient que : adresse (`slug`), nom commercial, description, mention de vérification, capacités actives, zones actives (ville, quartier, prix « à partir de » : le prix le plus bas de la version de la grille en vigueur, `null` = « tarif sur devis »), villes des sites actifs, date de publication. **Jamais** : raison sociale, téléphone, e-mail, RCCM, NIU, adresses, identifiant interne de l'agence, membres. Les tarifs affichés ne sont pas garantis sans devis. Elle suit l'agence sans nouvelle publication : profil, identité, soumission, zones, sites, capacités, grille.

La **description est du texte brut** : le balisage saisi (`<b>`, `<script>`) est conservé tel quel, jamais interprété par l'API. Tout client doit l'**échapper à l'affichage**.

## Audit

`marketplace.profile_published` et `marketplace.profile_unpublished` (table `identity_audit`) : auteur, agence (`agency_id` et `resource_id`), aucune valeur saisie ; aucune ligne pour un refus.

# Annuaire public — lot B3, tranche 5 (B3.10 à B3.13)

Deux routes **sans authentification**, préfixe `/api/v1`, qui ne lisent que la projection `public_agency_listings` du module (jamais une table d'`agencies` ni de `pricing`) et n'écrivent rien (aucune ligne d'audit). Seules les fiches **visibles** (publiées, agence soumise, au moins une capacité active, nom publiable) sont atteignables.

| Méthode | Chemin | Succès |
| --- | --- | --- |
| `GET` | `/public/agencies` | 200, `{ items, nextCursor, hasMore }` |
| `GET` | `/public/agencies/{slug}` | 200, la fiche |

## Ce qui est commun aux deux routes

- **Pas d'authentification** : aucun garde. Un en-tête `Authorization` (valide, invalide ou mal formé) est **ignoré**, sans 401 : la réponse est la même pour un visiteur et pour un membre, et un jeton invalide ne révèle rien.
- **Limitation de débit : 60 requêtes par minute et par adresse, par route** (D-24). Au-delà : **429** Problem Details avec `Retry-After`. Les requêtes refusées en 400 ou 404 comptent aussi. **Limites connues** : le compteur est **en mémoire, par instance** (N instances = N × 60), et l'adresse est celle de la **socket** (`trust proxy` n'est pas activé : `X-Forwarded-For` est ignoré, donc non falsifiable, mais derrière un proxy ou un répartiteur de charge tous les visiteurs partagent une seule adresse). Limitation partagée et proxy de confiance : B1.11 et B10.19, à faire **avant la production**. Configurable par `RATE_LIMIT_PUBLIC_PER_MINUTE` (60 par défaut) et `RATE_LIMIT_DEFAULT_PER_MINUTE` (120, autres routes sans limite propre) : en production ces valeurs peuvent être **abaissées, jamais relevées** (le démarrage est refusé au-dessus de 60 et de 120) ; les relever n'est permis qu'hors production, pour les essais.
- **`Cache-Control: no-store`** et aucun `Set-Cookie`. Choix : la réponse n'a rien de personnel, mais aucun cache partagé n'est introduit en B3 (Q-44) : une fiche retirée ou masquée doit disparaître à la lecture suivante, ce qu'un `max-age` empêcherait. À revoir seulement après mesure (B10.17), avec un `ETag`. Les réponses d'erreur (400, 404, 429) n'ajoutent pas cet en-tête.
- Erreurs en `application/problem+json`, message fixe (rien de la requête n'est renvoyé). Les réponses `400`, `404` et `429` portent `code: HTTP_ERROR`.
- **Texte brut** : la description et les noms sont renvoyés tels que saisis, balisage compris (`<b>`, `<script>`). **Tout client doit les échapper à l'affichage** (jamais `innerHTML` / `dangerouslySetInnerHTML` sans assainissement).
- La mention « non vérifiée » est le champ `verification: "unverified"` (toujours, jusqu'à l'approbation par la plateforme en B10) ; jamais « garantie », « assurée » ni « certifiée ».

## `GET /public/agencies`

Paramètres de la requête, en **liste fermée** (tout autre paramètre, y compris `agencyId`, `status`, `sort`, `zone`, `capability[]`, ou un paramètre répété sauf `capability` : **400**) :

| Paramètre | Règle |
| --- | --- |
| `q` | Texte contenu dans le nom, sans casse, accents ni espaces multiples ; 2 à 80 caractères après nettoyage ; caractères de contrôle ou de format (NUL, U+202E, U+200B…) refusés. Les `%`, `_` et `\` saisis sont des lettres, pas des jokers. |
| `city` | Ville d'une zone **active** ou d'un **site actif** (D-24, Q-43), mêmes règles de comparaison et de longueur que `q`. |
| `district` | Quartier ; **exige `city`**. Une agence correspond si elle dessert ce quartier ou la **ville entière** (zone sans quartier) ; les sites n'ont pas de quartier et ne comptent pas. |
| `capability` | `delivery` ou `storage`, **répétable** (au plus deux fois) ; les deux ensemble : agences **hybrides** seulement. Une capacité suspendue ne compte pas. Toute autre valeur (`hybrid`, `Delivery`, `delivery,storage`) : 400. |
| `limit` | Entier de 1 à 50, 20 par défaut. |
| `cursor` | La valeur `nextCursor` de la page précédente. |

Toutes les conditions se combinent (intersection). **Il n'existe pas de paramètre `zone`** : la zone desservie est la paire `city` + `district` (D-15).

**Ordre** : alphabétique du nom sans casse ni accents (`name_key`), puis de l'adresse (`slug`) ; il est total, donc deux pages ne se chevauchent jamais.

**Pagination par curseur** : `{ items, nextCursor, hasMore }`. `nextCursor` est opaque (base64url, ne pas l'interpréter) et vaut `null` à la dernière page. Il encode la position (nom normalisé, adresse) **et la recherche** qui l'a produit : le réutiliser avec d'autres `q`, `city`, `district` ou `capability` donne **400** ; la taille de page, elle, peut changer. Un curseur altéré, tronqué, allongé, rempli ou illisible : 400. Position par valeurs (keyset) : une fiche publiée entre deux pages n'en répète ni n'en fait manquer aucune ; une fiche qui entre avant le curseur n'est pas montrée, une qui entre après l'est.

```json
{
  "items": [
    {
      "slug": "express-douala",
      "tradeName": "Express Douala",
      "verification": "unverified",
      "capabilities": ["delivery"],
      "hybrid": false,
      "cities": ["Douala"]
    }
  ],
  "nextCursor": "WyJbXCJmbHQ5XC...",
  "hasMore": true
}
```

Chaque résultat contient **exactement** ces six champs : `slug`, `tradeName`, `verification`, `capabilities` (actives), `hybrid` (les deux), `cities` (villes des zones et sites actifs, une fois chacune, alphabétique). Jamais d'identifiant d'agence, de raison sociale, de contact, de RCCM, de NIU, d'adresse ni de membre. Aucun résultat : `{ "items": [], "nextCursor": null, "hasMore": false }`.

## `GET /public/agencies/{slug}`

```json
{
  "slug": "express-douala",
  "tradeName": "Express Douala",
  "description": "<b>Promo</b> Livraison 7j/7",
  "verification": "unverified",
  "capabilities": ["delivery"],
  "hybrid": false,
  "zones": [
    { "city": "Douala", "district": "Akwa", "startingPrice": 1000 },
    { "city": "Douala", "district": "Bonabéri", "startingPrice": 1500 }
  ],
  "siteCities": ["Douala"],
  "pricing": { "currency": "XAF", "notice": "indicative_not_guaranteed" },
  "publishedAt": "2026-11-12T09:30:00.000Z"
}
```

- Exactement ces dix champs. `zones` : zones **actives**, par ville puis quartier ; `district: null` = ville entière ; **pas d'identifiant de zone**. `startingPrice` : prix le plus bas de la version de grille en vigueur pour la zone, en XAF (entier), **non garanti sans devis** ; `null` : sur devis.
- `pricing.notice` : `indicative_not_guaranteed` (au moins une zone affiche un prix : afficher « Tarifs indicatifs, non garantis sans devis ») ou `on_quote` (aucun prix : afficher « tarifs sur devis », cas d'une agence de stockage seule ou sans grille).
- `description` : `null` si absente ; texte brut (voir plus haut).
- **404 uniforme** : slug inconnu, mal formé (majuscules, espaces, `..%2F`, caractère de contrôle, trop long…), fiche jamais publiée, retirée, masquée (aucune capacité active, nom provisoire ou non publiable), brouillon : **même statut, même corps** (le champ `instance` reprend le chemin demandé, `traceId` change) ; rien ne laisse deviner qu'une agence existe. Tout changement (zone retirée, site désactivé, capacité suspendue, fiche retirée) se voit à la lecture suivante.

## Index et performance (B3.13)

Mesures sur PostgreSQL 16 (`postgres:16-alpine`), table `public_agency_listings` de 2 000 puis 20 000 lignes (86 % visibles ; 20 villes, 1 à 5 zones par agence), `EXPLAIN (ANALYZE, BUFFERS)` des requêtes exactes du repository, page de 21 lignes :

| Requête | 2 000 lignes | 20 000 lignes | Plan |
| --- | --- | --- | --- |
| liste, 1re page | 0,30 ms | 0,30 ms | parcours de `public_agency_listings_visible_name_idx`, 21 lignes lues |
| liste, page suivante (keyset) | 0,19 ms | 0,28 ms | même index, `Index Cond` sur `(name_key, slug) >` |
| `city` présente, `capability`, hybride | 0,14 à 0,19 ms | 0,09 à 0,12 ms | même index, filtre sur la ligne, 5 à 50 lignes écartées |
| `city` + `district` | 1,3 ms | 1,5 ms | même index à 20 000 lignes ; parcours séquentiel à 2 000 |
| `q` (« contient »), présent ou absent | 0,7 à 0,9 ms | 6 à 7,5 ms | parcours séquentiel, filtre `LIKE` |
| `city` absente (pire cas) | 1,3 ms | 12 ms | à 20 000 : index entier parcouru, 17 150 lignes écartées |
| fiche par `slug` | 0,04 ms | — | `public_agency_listings_slug_unique` |

**Index retenus : aucun nouvel index.** L'index partiel d'ordre `(name_key, slug) WHERE visible` (tranche 4) sert le tri, la pagination et la visibilité ; l'index unique sur `slug` sert la fiche. La migration `1793900000000-public-listing-search-keys` n'ajoute que deux **colonnes** (`city_keys`, `district_keys` : clés de recherche déjà normalisées, jamais exposées) et complète les lignes existantes ; elles rendent le filtre exact (sans casse ni accents, identique à la comparaison des zones d'`agencies`) sans fonction appliquée à chaque ligne.

**Index rejetés, avec les chiffres** : essayés sur 20 000 lignes, un GIN `pg_trgm` sur `name_key` (`WHERE visible`) ramène `q` de 6 ms à 0,07 à 0,17 ms (sans effet pour 2 caractères : moins de trois lettres, parcours séquentiel malgré l'index, 5,9 ms) et un GIN sur `city_keys` ramène la ville absente de 17 ms à 0,06 ms. Aux volumes attendus (50 agences, quelques milliers de fiches au plus) le pire cas mesuré est de 1,6 ms ; à 60 requêtes par minute et par adresse, le coût de ces index (extension `pg_trgm`, écriture de la projection à chaque événement, taille) n'est pas justifié. **Seuil de réexamen** : plus d'environ 20 000 fiches visibles, ou un p95 de la route au-dessus de 50 ms aux mesures de B10.17. Procédure alors : `CREATE EXTENSION pg_trgm` (extension de confiance, disponible dans l'image), puis, hors transaction, `CREATE INDEX CONCURRENTLY public_agency_listings_name_trgm_idx ON public_agency_listings USING gin (name_key gin_trgm_ops) WHERE visible` et `CREATE INDEX CONCURRENTLY public_agency_listings_city_keys_idx ON public_agency_listings USING gin (city_keys) WHERE visible`, en déclarant les deux index sur l'entité (`@Index`) et en relisant `migration:check`.
