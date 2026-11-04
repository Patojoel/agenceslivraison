# language: fr
@UC-05-02 @B3.2
Fonctionnalité: Modifier une zone
  Afin de garder mes tarifs attachés à la bonne zone
  En tant que propriétaire ou administrateur d'agence
  Je veux corriger la ville ou le quartier d'une zone sans la recréer

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification avec la livraison active
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"
    Et "Express Douala" dessert les zones actives "Douala / Akwaa" et "Douala / Bonabéri"
    Et la version 1 de la grille tarife "Douala / Akwaa" à 1 000 FCFA jusqu'à 1 kg

  @nominal @RG-05-02-01
  Scénario: Un administrateur corrige une faute dans le quartier
    Quand "Paul Mbarga" corrige la zone "Douala / Akwaa" en "Douala" quartier "Akwa"
    Alors la zone porte le libellé "Douala / Akwa"
    Et elle garde le même identifiant

  @nominal @RG-05-02-01 @RG-05-02-04
  Scénario: Le tarif suit la zone corrigée
    Étant donné "Paul Mbarga" a corrigé la zone "Douala / Akwaa" en "Douala / Akwa"
    Quand "Céline Fotso" simule le prix d'un colis de 1 kg vers "Douala / Akwa"
    Alors le prix indicatif est de 1 000 FCFA selon la version 1

  @alternatif @RG-05-02-04 @RM-05-01
  Scénario: Un devis émis garde le libellé de la zone au moment de l'émission
    Étant donné le devis "DEV-2026-000001" émis vers "Douala / Akwaa"
    Quand "Paul Mbarga" corrige la zone "Douala / Akwaa" en "Douala / Akwa"
    Alors le devis "DEV-2026-000001" indique toujours la zone "Douala / Akwaa"
    Et son total est inchangé

  @erreur @RG-05-02-02
  Plan du scénario: Une correction qui crée un doublon est refusée
    Étant donné "Express Douala" a aussi <situation>
    Quand "Paul Mbarga" corrige la zone "Douala / Akwaa" en "<ville>" quartier "<quartier>"
    Alors la correction est refusée pour <motif>
    Et la zone "Douala / Akwaa" garde son libellé

    Exemples:
      | situation                                     | ville  | quartier | motif                         |
      | la zone active "Douala / Deïdo"               | douala | DEIDO    | doublon                       |
      | la zone retirée "Douala / Bépanda"            | Douala | Bépanda  | doublon d'une zone à réactiver |

  @erreur @RG-05-02-03
  Scénario: Une zone retirée ne se modifie pas
    Étant donné la zone "Douala / Bépanda" retirée de "Express Douala"
    Quand "Paul Mbarga" corrige la zone "Douala / Bépanda" en "Douala" quartier "Bépanda Omnisport"
    Alors la correction est refusée car la zone est retirée

  @erreur @RG-05-02-01
  Plan du scénario: Bornes de longueur du quartier corrigé
    Quand "Paul Mbarga" corrige la zone "Douala / Akwaa" avec un quartier de <longueur> caractères utiles
    Alors la correction est <résultat>

    Exemples:
      | longueur | résultat |
      | 1        | refusée  |
      | 2        | acceptée |
      | 80       | acceptée |
      | 81       | refusée  |

  @alternatif @RG-05-02-05
  Scénario: Une correction identique ne change rien
    Étant donné la zone active "Douala / Bonabéri"
    Quand "Paul Mbarga" corrige la zone "Douala / Bonabéri" en "Douala" quartier "Bonabéri"
    Alors la zone est inchangée
    Et aucune trace n'est ajoutée au journal d'audit

  @erreur @securite @RG-05-02-06 @EX-05-002
  Scénario: Une agente ne peut pas modifier une zone
    Quand "Céline Fotso" corrige la zone "Douala / Akwaa" en "Douala" quartier "Akwa"
    Alors l'action lui est refusée comme non autorisée
    Et la zone "Douala / Akwaa" garde son libellé

  @erreur @securite @RG-05-02-06 @EX-05-001
  Plan du scénario: Une personne sans accès actif ne trouve pas la zone
    Étant donné <situation>
    Quand "<personne>" corrige la zone "Douala / Akwaa" de "Express Douala"
    Alors la zone lui est introuvable

    Exemples:
      | personne      | situation                                                   |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"       |

  @erreur @securite @RG-05-02-06 @RM-05-05
  Scénario: La zone d'une autre agence est introuvable
    Étant donné l'agence "Rapide Yaoundé" dessert la zone "Yaoundé / Bastos"
    Quand "Awa Ngono" corrige, au nom de "Express Douala", la zone "Yaoundé / Bastos"
    Alors la zone lui est introuvable
    Et la zone "Yaoundé / Bastos" de "Rapide Yaoundé" est inchangée

  @nominal @RG-05-02-07 @EX-05-005
  Scénario: La correction est tracée sans les valeurs saisies
    Quand "Paul Mbarga" corrige la zone "Douala / Akwaa" en "Douala" quartier "Akwa"
    Alors le journal d'audit contient « zone modifiée » par "Paul Mbarga" pour cette zone
    Et la trace nomme le champ "quartier" sans en donner la valeur

  @erreur @RG-05-02-07
  Scénario: Une correction refusée n'écrit aucune trace
    Étant donné la zone active "Douala / Deïdo"
    Quand "Paul Mbarga" corrige la zone "Douala / Akwaa" en "Douala" quartier "Deïdo"
    Alors la correction est refusée pour doublon
    Et aucune trace n'est ajoutée au journal d'audit

  @concurrence @RG-05-02-08 @EX-05-004
  Scénario: Deux corrections simultanées vers le même libellé n'en retiennent qu'une
    Quand "Paul Mbarga" corrige "Douala / Akwaa" et "Awa Ngono" corrige "Douala / Bonabéri" en même temps en "Douala / Deïdo"
    Alors une seule zone porte le libellé "Douala / Deïdo"
    Et l'autre correction est refusée pour doublon
