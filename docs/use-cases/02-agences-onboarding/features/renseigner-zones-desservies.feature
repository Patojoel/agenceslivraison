# language: fr
@UC-02-03 @B2.3
Fonctionnalité: Renseigner les zones desservies
  Afin de pouvoir activer la livraison
  En tant que propriétaire ou administrateur d'agence
  Je veux déclarer et retirer les zones desservies par mon agence

  Contexte:
    Étant donné l'agence "Express Douala" au statut brouillon
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"

  @nominal @RG-02-03-01
  Scénario: Un administrateur ajoute un quartier desservi
    Quand "Paul Mbarga" ajoute la zone "Douala" quartier "Akwa" à "Express Douala"
    Alors "Express Douala" dessert la zone active "Douala / Akwa"

  @nominal @RG-02-03-01
  Scénario: La propriétaire ajoute une ville entière
    Quand "Awa Ngono" ajoute la zone "Yaoundé" sans quartier à "Express Douala"
    Alors "Express Douala" dessert la zone active "Yaoundé"

  @alternatif @RG-02-03-03 @EX-02-007
  Scénario: Une zone retirée est conservée dans l'historique
    Étant donné "Express Douala" dessert les zones "Douala / Akwa" et "Douala / Bonabéri"
    Quand "Paul Mbarga" retire la zone "Douala / Bonabéri"
    Alors la zone "Douala / Bonabéri" apparaît comme retirée avec sa date de retrait
    Et "Express Douala" dessert toujours la zone active "Douala / Akwa"

  @alternatif @RG-02-03-04
  Scénario: Ajouter une zone retirée la réactive
    Étant donné la zone "Douala / Bonabéri" retirée de "Express Douala"
    Quand "Paul Mbarga" ajoute la zone "Douala" quartier "Bonabéri"
    Alors la zone "Douala / Bonabéri" est de nouveau active
    Et "Express Douala" ne compte qu'une seule zone "Douala / Bonabéri"

  @erreur @RG-02-03-02
  Plan du scénario: Une zone déjà desservie est refusée comme doublon
    Étant donné "Express Douala" dessert la zone active "Douala / Akwa"
    Quand "Paul Mbarga" ajoute la zone "<ville>" quartier "<quartier>"
    Alors l'ajout est refusé pour doublon
    Et "Express Douala" ne compte qu'une seule zone "Douala / Akwa"

    Exemples:
      | ville   | quartier |
      | Douala  | Akwa     |
      | douala  | AKWA     |
      | Douala  | Akwá     |

  @erreur @RG-02-03-01
  Plan du scénario: Bornes de longueur de la ville
    Quand "Paul Mbarga" ajoute une zone dont la ville compte <longueur> caractères utiles
    Alors l'ajout est <résultat>

    Exemples:
      | longueur | résultat |
      | 1        | refusé   |
      | 2        | accepté  |
      | 80       | accepté  |
      | 81       | refusé   |

  @erreur @RG-02-03-05 @RM-02-02
  Scénario: La dernière zone ne peut pas être retirée tant que la livraison est active
    Étant donné "Express Douala" dessert la seule zone active "Douala / Akwa"
    Et la capacité livraison de "Express Douala" est active
    Quand "Paul Mbarga" retire la zone "Douala / Akwa"
    Alors le retrait est refusé pour conflit
    Et la zone "Douala / Akwa" reste active

  @alternatif @RG-02-03-05
  Scénario: La dernière zone peut être retirée si la livraison n'est pas active
    Étant donné "Express Douala" dessert la seule zone active "Douala / Akwa"
    Et la capacité livraison de "Express Douala" n'est pas active
    Quand "Paul Mbarga" retire la zone "Douala / Akwa"
    Alors "Express Douala" ne dessert plus aucune zone active

  @erreur @RG-02-03-06
  Scénario: Une 101e zone active est refusée
    Étant donné "Express Douala" dessert 100 zones actives
    Quand "Paul Mbarga" ajoute la zone "Kribi" sans quartier
    Alors l'ajout est refusé pour conflit
    Et "Express Douala" dessert toujours 100 zones actives

  @concurrence @RG-02-03-02 @EX-02-004
  Scénario: Deux ajouts simultanés de la même zone n'en créent qu'une
    Quand "Awa Ngono" et "Paul Mbarga" ajoutent en même temps la zone "Douala" quartier "Deïdo"
    Alors "Express Douala" ne compte qu'une seule zone "Douala / Deïdo"
    Et l'un des deux ajouts est refusé pour doublon

  @erreur @securite @RG-02-03-07 @EX-02-002
  Scénario: Une agente ne peut pas modifier les zones desservies
    Quand "Céline Fotso" ajoute la zone "Douala" quartier "Bali"
    Alors l'action lui est refusée comme non autorisée
    Et "Express Douala" ne dessert pas la zone "Douala / Bali"

  @erreur @securite @RG-02-03-07 @EX-02-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" ajoute la zone "Douala" quartier "Bali" à "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable

    Exemples:
      | personne      | situation                                                    |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement  |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"        |

  @erreur @securite @RG-02-03-07 @EX-02-001
  Scénario: Une zone d'une autre agence est introuvable
    Étant donné l'agence "Rapide Yaoundé" dessert la zone "Yaoundé / Bastos"
    Quand "Awa Ngono" retire, au nom de "Express Douala", la zone "Yaoundé / Bastos" de "Rapide Yaoundé"
    Alors la zone lui est introuvable
    Et la zone "Yaoundé / Bastos" de "Rapide Yaoundé" reste active

  @alternatif @RG-02-03-08
  Scénario: Une agence soumise peut encore ajouter une zone
    Étant donné "Express Douala" soumise à vérification
    Quand "Paul Mbarga" ajoute la zone "Douala" quartier "Bépanda"
    Alors "Express Douala" dessert la zone active "Douala / Bépanda"

  @nominal @RG-02-03-09 @EX-02-005
  Scénario: L'ajout d'une zone est tracé dans le journal d'audit
    Quand "Paul Mbarga" ajoute la zone "Douala" quartier "Akwa"
    Alors le journal d'audit contient « zone ajoutée : Douala / Akwa » par "Paul Mbarga"
