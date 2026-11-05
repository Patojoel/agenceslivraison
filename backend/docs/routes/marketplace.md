# Marketplace — fiche publique de l'agence — lot B3, tranche 4

Trois routes, sous l'agence : publier la fiche (B3.9), la retirer, et lire son état. Elles alimentent la projection que l'annuaire lira (routes `/public/...`, tranche 5 : aucune route publique n'existe encore). Toutes demandent `Authorization: Bearer <jeton d'accès>` et répondent `Cache-Control: no-store` ; les erreurs sont en `application/problem+json`. Préfixe `/api/v1`.

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

La projection `public_agency_listings` (lue par les routes publiques de la tranche 5) ne contient que : adresse (`slug`), nom commercial, description, mention de vérification, capacités actives, zones actives (ville, quartier, prix « à partir de » : le prix le plus bas de la version de la grille en vigueur, `null` = « tarif sur devis »), villes des sites actifs, date de publication. **Jamais** : raison sociale, téléphone, e-mail, RCCM, NIU, adresses, identifiant interne de l'agence, membres. Les tarifs affichés ne sont pas garantis sans devis. Elle suit l'agence sans nouvelle publication : profil, identité, soumission, zones, sites, capacités, grille.

La **description est du texte brut** : le balisage saisi (`<b>`, `<script>`) est conservé tel quel, jamais interprété par l'API. Tout client doit l'**échapper à l'affichage**.

## Audit

`marketplace.profile_published` et `marketplace.profile_unpublished` (table `identity_audit`) : auteur, agence (`agency_id` et `resource_id`), aucune valeur saisie ; aucune ligne pour un refus.
