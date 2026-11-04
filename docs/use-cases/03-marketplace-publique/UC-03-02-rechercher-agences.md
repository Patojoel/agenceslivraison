# UC-03-02 — Rechercher des agences

| Champ | Valeur |
|---|---|
| Statut | Brouillon (en attente de Q-42, Q-44) |
| Priorité | Must |
| Domaine | `marketplace` (lecture publique) |
| Tâche | B3.10 (+ B3.13 : index, EXPLAIN, limitation de débit) |
| Date | 2026-11-04 |
| Use cases liés | UC-03-01 (publication, visibilité) ; UC-03-03 (filtres) ; UC-03-04 (consultation) |
| Exigences couvertes | UC-03-02, RM-03-01, EX-03-001 à 004, 006, 007, 009, 012 |

## 0. Traçabilité

| Exigence | Source | Où elle est traitée |
|---|---|---|
| UC-03-02 | F03 §2 ; PH B3.10 ; RDM lot 3 (« recherches paginées ») | §8 ; scénarios 1, 2 |
| RM-03-01 | F03 §Règles ; ADR-10 | RG-03-02-02 ; scénario 7 |
| EX-03-001 (sans authentification, débit limité) | PH B3.13 ; consigne B3 | RG-03-02-06, 07 ; scénarios 11, 12 |
| EX-03-003 (non visibles absentes) | consigne B3 ; D-05 | RG-03-02-01 ; scénario 6 |
| EX-03-004 (curseur, liste fermée de paramètres) | ARC5 | RG-03-02-03, 05 ; scénarios 4, 8, 9, 10 |
| EX-03-006, 007 | revue sécurité B2 | RG-03-02-01 ; scénario 6 |
| EX-03-009 (index, EXPLAIN) | ARC3 §Indices ; PH B3.13 | §15 ; test 11 |
| EX-03-012 (pas d'identifiant interne) | Q-36 | RG-03-02-02 |

## 1. Objectif

Permettre à n'importe qui de trouver des agences publiées, par leur nom, page après page, sans jamais voir une agence non publiée ni une donnée privée.

## 2. User story

> En tant que **visiteur de la marketplace** (particulier ou commerçant, connecté ou non), je veux **parcourir et rechercher les agences publiées**, afin de **choisir à qui confier ma livraison ou mon stock**.

## 3. Acteurs

Principal : visiteur public non connecté. Une personne connectée obtient exactement la même réponse.

## 4. Déclencheur

Le visiteur ouvre l'annuaire ou saisit un nom.

## 5. Préconditions

Aucune authentification. Débit de l'adresse client sous la limite.

## 6. Postconditions

Lecture seule : aucune écriture, aucune trace d'audit.

## 7. Règles métier

| ID | Règle | Exemple | Source |
|---|---|---|---|
| RG-03-02-01 | N'apparaissent que les fiches **visibles** : publiées, agence soumise (ou approuvée), au moins une capacité active, nom publiable (non provisoire, sans caractère de contrôle ni de format). | « Colis Bafoussam » (brouillon), « Taxi Colis » (soumise, non publiée), « Agence 7b2e4a10 » (nom provisoire) : absentes. | D-05 ; RG-03-01-01, 04 à 06 |
| RG-03-02-02 | Chaque résultat est un résumé en liste fermée : slug, nom commercial, mention de vérification, capacités actives, villes desservies. Aucune autre donnée, aucun identifiant interne. | `{ slug, tradeName, verification, capabilities, cities }`. | RM-03-01 ; ADR-10 |
| RG-03-02-03 | Pagination par curseur `{ items, nextCursor, hasMore }`, 1 à 50 éléments par page, 20 par défaut **[HYPOTHÈSE]** ; ordre stable : nom normalisé (sans casse ni accents) puis slug **[HYPOTHÈSE]** (Q-42) ; sans changement des données, aucune répétition ni omission entre pages. | 45 agences visibles, 20 par page → 20, 20, 5 ; la 3e page a `hasMore: false`. | ARC5 ; RDM lot 3 |
| RG-03-02-04 | Texte de recherche facultatif, 2 à 80 caractères, comparé au nom commercial sans casse ni accents (« contient ») **[HYPOTHÈSE]** (Q-42) ; caractères de contrôle ou de format refusés. | « express », « EXPRESS », « éxpress » → Express Douala. | [HYPOTHÈSE] |
| RG-03-02-05 | Paramètres en **liste fermée** : texte, filtres de UC-03-03, limite, curseur ; tout autre paramètre est refusé. | `agencyId`, `status=draft`, `sort=createdAt` → refus. | ARC5 (filtres allowlist) |
| RG-03-02-06 | Aucune authentification exigée ; un jeton présenté ne donne aucune donnée supplémentaire. | Awa connectée voit la même liste qu'un visiteur. | consigne B3 |
| RG-03-02-07 | **[HYPOTHÈSE]** (Q-44) Débit limité à 60 requêtes par minute et par adresse client (par instance tant que B10.19 n'est pas livré) ; au-delà : « trop de requêtes ». | 61e requête dans la minute → refus. | PH B3.13 ; consigne B3 |
| RG-03-02-08 | Aucun résultat → liste vide, sans erreur. | « zzz » → `items: []`, `hasMore: false`. | ARC5 |
| RG-03-02-09 | Curseur illisible ou altéré → refus (donnée invalide). | Curseur modifié à la main → refus. | ARC5 |

## 8. Flux nominal

1. Le visiteur demande la liste, avec ou sans texte.
2. Le système contrôle le débit (RG-03-02-07) et les paramètres (RG-03-02-04, 05, 09).
3. Le système sélectionne les fiches visibles (RG-03-02-01) correspondant au texte.
4. Le système trie (RG-03-02-03) et prend une page à partir du curseur.
5. Le système renvoie les résumés (RG-03-02-02), `nextCursor` et `hasMore`.

## 9. Flux alternatifs

- A1 — Aucun résultat : liste vide (RG-03-02-08).
- A2 — Page suivante : le visiteur renvoie `nextCursor` ; mêmes paramètres.

## 10. Flux d'exception

- E1 — Paramètre inconnu, limite hors bornes, texte invalide, curseur altéré : 400.
- E2 — Débit dépassé : 429.
- E3 — Base indisponible : 503.

## 11. Workflow

```mermaid
sequenceDiagram
    actor V as Visiteur
    participant M as Marketplace (lecture publique)
    V->>M: liste (texte ?, filtres ?, limite ?, curseur ?)
    M->>M: débit ; paramètres en liste fermée
    M->>M: fiches visibles seulement (publiée, soumise, capacité active, nom publiable)
    M->>M: tri nom normalisé puis slug ; page après le curseur
    M-->>V: { items: résumés autorisés, nextCursor, hasMore }
```

## 12. Scénarios d'acceptation (Gherkin)

Copie conforme de [features/rechercher-agences.feature](features/rechercher-agences.feature).

```gherkin
# language: fr
@UC-03-02 @B3.10
Fonctionnalité: Rechercher des agences
  Afin de choisir à qui confier ma livraison ou mon stock
  En tant que visiteur de la marketplace
  Je veux parcourir et rechercher les agences publiées

  Contexte:
    Étant donné les fiches publiques visibles "Express Douala" (non vérifiée) et "Rapide Yaoundé" (non vérifiée)
    Et l'agence "Colis Bafoussam" au statut brouillon
    Et l'agence "Taxi Colis" soumise dont la fiche n'est pas publiée

  @nominal @RG-03-02-01 @RG-03-02-06
  Scénario: Un visiteur non connecté parcourt l'annuaire
    Quand un visiteur non connecté consulte l'annuaire des agences
    Alors il voit "Express Douala" puis "Rapide Yaoundé", chacune avec la mention « non vérifiée »
    Et il ne voit ni "Colis Bafoussam" ni "Taxi Colis"

  @nominal @RG-03-02-04
  Scénario: Un visiteur recherche une agence par son nom
    Quand un visiteur recherche "express"
    Alors il voit uniquement "Express Douala"

  @alternatif @RG-03-02-04
  Plan du scénario: La recherche ignore la casse et les accents
    Quand un visiteur recherche "<texte>"
    Alors il voit "<agence>"

    Exemples:
      | texte    | agence         |
      | EXPRESS  | Express Douala |
      | éxpress  | Express Douala |
      | yaounde  | Rapide Yaoundé |

  @alternatif @RG-03-02-03
  Scénario: La pagination parcourt toutes les agences sans doublon ni oubli
    Étant donné 45 fiches publiques visibles
    Quand un visiteur parcourt l'annuaire par pages de 20 jusqu'à la dernière
    Alors il obtient des pages de 20, 20 et 5 agences
    Et chaque agence apparaît exactement une fois
    Et la dernière page indique qu'il n'y a plus de résultat

  @alternatif @RG-03-02-08
  Scénario: Une recherche sans résultat renvoie une liste vide
    Quand un visiteur recherche "zzz"
    Alors la liste est vide
    Et elle indique qu'il n'y a plus de résultat

  @erreur @securite @RG-03-02-01
  Plan du scénario: Une agence non visible n'apparaît jamais
    Étant donné <situation>
    Quand un visiteur consulte l'annuaire des agences
    Alors "<agence>" n'y figure pas

    Exemples:
      | agence           | situation                                                                    |
      | Colis Bafoussam  | l'agence "Colis Bafoussam" au statut brouillon                               |
      | Taxi Colis       | l'agence "Taxi Colis" soumise dont la fiche n'est pas publiée               |
      | Livraison Kribi  | l'agence "Livraison Kribi" dont la fiche a été retirée                      |
      | Agence 7b2e4a10  | une agence soumise publiée portant encore son nom provisoire "Agence 7b2e4a10" |
      | Stock Limbé      | la fiche "stock-limbe" publiée dont toutes les capacités sont suspendues    |

  @nominal @securite @RG-03-02-02 @RM-03-01
  Scénario: Un résultat ne contient que le résumé autorisé
    Étant donné l'identité complète et les membres de "Express Douala" sont renseignés
    Quand un visiteur consulte l'annuaire des agences
    Alors le résultat "Express Douala" contient seulement l'adresse publique, le nom, la mention de vérification, les capacités et les villes desservies

  @erreur @securite @RG-03-02-05
  Plan du scénario: Un paramètre hors de la liste autorisée est refusé
    Quand un visiteur consulte l'annuaire avec le paramètre "<paramètre>"
    Alors la recherche est refusée comme invalide

    Exemples:
      | paramètre        |
      | agencyId=…       |
      | status=draft     |
      | sort=createdAt   |

  @erreur @RG-03-02-03 @RG-03-02-04
  Plan du scénario: Des valeurs de recherche hors bornes sont refusées
    Quand un visiteur consulte l'annuaire avec <valeur>
    Alors la recherche est refusée comme invalide

    Exemples:
      | valeur                                   |
      | une limite de 0                          |
      | une limite de 51                         |
      | un texte de 1 caractère                  |
      | un texte de 81 caractères                |
      | un texte contenant le caractère U+202E   |

  @erreur @securite @RG-03-02-09
  Scénario: Un curseur altéré est refusé
    Étant donné un visiteur a obtenu une première page et son curseur
    Quand il demande la page suivante avec un curseur modifié
    Alors la recherche est refusée comme invalide

  @erreur @securite @RG-03-02-07
  Scénario: Un visiteur trop insistant est temporairement limité
    Étant donné un visiteur a consulté l'annuaire 60 fois dans la dernière minute
    Quand il consulte l'annuaire une 61e fois
    Alors la consultation est refusée pour trop de requêtes

  @alternatif @RG-03-02-06
  Scénario: Une personne connectée voit la même chose qu'un visiteur
    Étant donné "Awa Ngono" propriétaire active de "Express Douala" et connectée
    Quand "Awa Ngono" consulte l'annuaire des agences
    Alors elle obtient exactement la même liste qu'un visiteur non connecté
```

## 13. Plan de tests TDD

Lecture : testée en E2E sur PostgreSQL (skill `core-tdd`) ; seuls les objets de paramètres ont des tests unitaires.

| # | Niveau | Comportement | Étant donné | Quand | Alors | Règle |
|---|---|---|---|---|---|---|
| 1 | unit (VO `PublicSearchParams`) | Paramètres | — | texte 1, 2, 80, 81, U+202E ; limite 0, 1, 50, 51 ; paramètre inconnu | bornes respectées ; normalisation casse et accents ; `invalid` | RG-03-02-03, 04, 05 |
| 2 | unit (VO `PublicCursor`) | Curseur | — | encoder, décoder ; altérer un octet | aller-retour identique ; `invalid` | RG-03-02-09 |
| 3 | E2E | Visibilité | 2 visibles ; brouillon ; non publiée ; retirée ; nom provisoire ; sans capacité active ; nom avec U+200B | lister | seules les 2 visibles | RG-03-02-01 |
| 4 | E2E | Liste fermée | identité, membres, motifs remplis | lister | ensemble des clés de chaque élément = liste autorisée ; aucune valeur privée dans le corps | RG-03-02-02 |
| 5 | E2E | Pagination stable | 45 visibles | 3 pages de 20 | 20, 20, 5 ; union = 45 sans doublon ; `hasMore` faux à la fin | RG-03-02-03 |
| 6 | E2E | Texte | — | « EXPRESS », « éxpress », « yaounde », « zzz » | résultats attendus ; liste vide | RG-03-02-04, 08 |
| 7 | E2E | 400 | — | paramètres inconnus, bornes, curseur altéré | 400 Problem Details | RG-03-02-05, 09 |
| 8 | E2E | 429 | — | 61 requêtes en une minute | 429 | RG-03-02-07 |
| 9 | E2E | Avec jeton | personne connectée | lister | même corps que sans jeton | RG-03-02-06 |
| 10 | E2E | Aucune écriture | — | lister | aucune ligne d'audit ; `Cache-Control` conforme à Q-44 | §6 |
| 11 | feature (PostgreSQL, `query-perf`) | Index | 50 agences, 5 000 zones | EXPLAIN ANALYZE de la requête de liste et de recherche | parcours d'index sur la clé de tri et la visibilité ; pas de parcours séquentiel des tables privées | EX-03-009 |

## 14. Données

Entrée (requête) : `q` (texte, facultatif), filtres de UC-03-03, `limit` (1 à 50, défaut 20), `cursor` (opaque).
Sortie : `{ items: [{ slug, tradeName, verification: "unverified" | "verified", capabilities: ["delivery" | "storage"], hybrid, cities: [..] }], nextCursor, hasMore }`.

## 15. Exigences non fonctionnelles

- Temps de réponse à mesurer (B10.17) pour 50 agences et leurs zones ; index ajustés après EXPLAIN (B3.13).
- La requête publique ne lit qu'une projection autorisée : impossible, même par erreur de code, d'y joindre l'identité ou les memberships.
- Limitation de débit partagée et proxy de confiance avant la production (B1.11, B10.19).

## 16. Hors périmètre

Recherche plein texte avancée, tri par pertinence, géolocalisation, mise en avant payante, avis et notes ; recherche dans la description.

## 17. Questions ouvertes

| # | Question | Hypothèse retenue | Impact si différent |
|---|---|---|---|
| Q-42 | Ordre des résultats et portée du texte ? | Ordre alphabétique du nom normalisé ; texte sur le nom seulement. | Index et curseur différents ; équité de l'ordre à décider (par exemple aléatoire stable). |
| Q-44 | Limite de débit publique et mise en cache ? | 60 requêtes par minute et par adresse ; pas de cache public partagé en B3. | Paramètres de limite ; en-têtes de cache. |

## 18. Notes pour le tech lead

- Route `GET /public/agencies` sans `AccessTokenGuard` ; `ZodValidationPipe` `.strict()` sur les paramètres de requête.
- Le curseur encode la clé de tri (nom normalisé, slug) et l'empreinte des filtres (UC-03-03).

Definition of Ready :
- [x] Chaque exigence de la section 0 a au moins un scénario
- [x] Chaque règle a un exemple
- [x] Chaque flux d'exception a un scénario (E3 : contrat général)
- [ ] Aucune question bloquante (Q-42, Q-44 : mineures)
- [x] Le plan TDD couvre chaque règle
- [x] Le `.feature` est synchronisé avec la section 12
