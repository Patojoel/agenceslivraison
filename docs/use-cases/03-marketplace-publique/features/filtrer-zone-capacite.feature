# language: fr
@UC-03-03 @B3.11
Fonctionnalité: Filtrer les agences par zone et par capacité
  Afin de ne voir que les agences qui peuvent réellement me servir
  En tant que visiteur de la marketplace
  Je veux filtrer l'annuaire par ville, quartier et capacité

  Contexte:
    Étant donné les fiches publiques visibles suivantes :
      | agence            | capacités actives     | zones actives                           | villes des sites actifs |
      | Express Douala    | livraison             | Douala / Akwa, Douala / Bonabéri        | Douala                  |
      | Rapide Yaoundé    | livraison             | Yaoundé                                 | Yaoundé                 |
      | Stock Plus Douala | stockage              |                                         | Douala                  |
      | Logi Hybride      | livraison, stockage   | Douala / Bonapriso                      | Douala                  |

  @nominal @RG-03-03-02
  Scénario: Un visiteur filtre par ville
    Quand un visiteur filtre l'annuaire sur la ville "Douala"
    Alors il voit "Express Douala", "Logi Hybride" et "Stock Plus Douala"
    Et il ne voit pas "Rapide Yaoundé"

  @nominal @RG-03-03-01 @RG-03-03-02
  Plan du scénario: Un quartier est couvert par la zone exacte ou par la ville entière
    Quand un visiteur filtre l'annuaire sur la ville "<ville>" et le quartier "<quartier>"
    Alors il voit <résultat>

    Exemples:
      | ville   | quartier  | résultat                     |
      | douala  | AKWA      | uniquement "Express Douala"  |
      | Douala  | Bonapriso | uniquement "Logi Hybride"    |
      | Douala  | Bépanda   | aucune agence                |
      | Yaoundé | Bastos    | uniquement "Rapide Yaoundé"  |

  @nominal @RG-03-03-03
  Plan du scénario: Un visiteur filtre par capacité
    Quand un visiteur filtre l'annuaire sur la capacité <capacité>
    Alors il voit <résultat>

    Exemples:
      | capacité              | résultat                                                  |
      | livraison             | "Express Douala", "Logi Hybride" et "Rapide Yaoundé"      |
      | stockage              | "Logi Hybride" et "Stock Plus Douala"                     |
      | livraison et stockage | uniquement "Logi Hybride"                                 |

  @alternatif @RG-03-03-05
  Scénario: Les filtres et le texte se combinent
    Quand un visiteur filtre l'annuaire sur la ville "Douala", la capacité livraison et le texte "logi"
    Alors il voit uniquement "Logi Hybride"

  @alternatif @RG-03-03-03 @RM-02-03
  Scénario: Une capacité suspendue n'est plus retenue
    Étant donné "Logi Hybride" a suspendu son stockage
    Quand un visiteur filtre l'annuaire sur la capacité stockage
    Alors il voit uniquement "Stock Plus Douala"

  @alternatif @RG-03-03-04 @RM-05-02
  Scénario: Une zone retirée n'est plus retenue
    Étant donné "Express Douala" a retiré la zone "Douala / Akwa"
    Quand un visiteur filtre l'annuaire sur la ville "Douala" et le quartier "Akwa"
    Alors il ne voit aucune agence

  @alternatif @RG-03-03-02
  Scénario: Une agence de stockage sans zone est trouvée par la ville de son site
    Quand un visiteur filtre l'annuaire sur la ville "Douala" et la capacité stockage
    Alors il voit "Logi Hybride" et "Stock Plus Douala"

  @erreur @RG-03-03-01 @RG-03-03-03
  Plan du scénario: Un filtre invalide est refusé
    Quand un visiteur filtre l'annuaire avec <filtre>
    Alors la recherche est refusée comme invalide

    Exemples:
      | filtre                                        |
      | la capacité "transport"                       |
      | le quartier "Akwa" sans ville                 |
      | la ville "D"                                  |
      | la ville "Douala" suivie du caractère U+200B  |

  @erreur @RG-03-03-06
  Scénario: Un curseur ne sert pas pour d'autres filtres
    Étant donné un visiteur a obtenu la première page et le curseur du filtre ville "Douala"
    Quand il demande la page suivante du filtre ville "Yaoundé" avec ce curseur
    Alors la recherche est refusée comme invalide

  @erreur @securite @RG-03-03-07
  Scénario: Un filtre ne révèle jamais une agence non visible
    Étant donné l'agence "Colis Bafoussam" au statut brouillon desservant la zone "Douala / Akwa"
    Quand un visiteur filtre l'annuaire sur la ville "Douala" et le quartier "Akwa"
    Alors il voit uniquement "Express Douala"

  @alternatif @RG-03-03-04
  Scénario: Un site désactivé n'est plus retenu
    Étant donné "Stock Plus Douala" a désactivé son site à Douala et ouvert un site actif à Kribi
    Quand un visiteur filtre l'annuaire sur la ville "Douala" et la capacité stockage
    Alors il voit uniquement "Logi Hybride"
