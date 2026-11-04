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
