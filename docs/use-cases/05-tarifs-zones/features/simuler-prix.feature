# language: fr
@UC-05-06 @B3.6
Fonctionnalité: Simuler un prix
  Afin de renseigner un client avant de lui émettre un devis
  En tant que membre d'agence
  Je veux obtenir le prix d'une livraison à partir de la zone et du poids des colis

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification avec la livraison active
    Et "Céline Fotso" agente active de "Express Douala"
    Et "Express Douala" dessert les zones actives "Douala / Akwa", "Douala / Bonabéri" et "Douala / Deïdo"
    Et la version 1 de la grille de "Express Douala" en vigueur :
      | zone              | jusqu'à | prix (FCFA) |
      | Douala / Akwa     | 1 kg    | 1000        |
      | Douala / Akwa     | 5 kg    | 1500        |
      | Douala / Akwa     | 10 kg   | 2500        |
      | Douala / Akwa     | 30 kg   | 5000        |
      | Douala / Bonabéri | 1 kg    | 1500        |

  @nominal @RG-05-06-01 @RG-05-06-03 @RG-05-06-06 @RM-03-05
  Scénario: Une agente simule le prix de deux colis
    Quand "Céline Fotso" simule une livraison vers "Douala / Akwa" de deux colis de 0,8 kg et de 3 kg
    Alors les prix indicatifs sont de 1000 FCFA et de 1500 FCFA
    Et le total indicatif est de 2500 FCFA selon la version 1
    Et le résultat porte la mention « prix indicatif, non garanti sans devis »

  @nominal @RG-05-06-01 @RG-05-06-03
  Plan du scénario: La borne d'une tranche est incluse
    Quand "Céline Fotso" simule une livraison vers "Douala / Akwa" d'un colis de <poids>
    Alors le prix indicatif est de <prix> FCFA

    Exemples:
      | poids     | prix |
      | 0,999 kg  | 1000 |
      | 1 kg      | 1000 |
      | 1000 g    | 1000 |
      | 1,001 kg  | 1500 |
      | 30 kg     | 5000 |

  @alternatif @RG-05-06-02
  Plan du scénario: Le poids volumétrique s'applique quand il dépasse le poids réel
    Étant donné la version en vigueur applique un diviseur volumétrique de 5000
    Quand "Céline Fotso" simule une livraison vers "Douala / Akwa" d'un colis de <poids> mesurant <dimensions>
    Alors le poids taxable est de <taxable>
    Et le prix indicatif est de <prix> FCFA

    Exemples:
      | poids  | dimensions         | taxable | prix |
      | 0,5 kg | 30 × 20 × 10 cm    | 1,2 kg  | 1500 |
      | 2 kg   | 10 × 10 × 10 cm    | 2 kg    | 1500 |

  @alternatif @RG-05-06-04
  Scénario: Un colis hors barème est signalé sans total
    Quand "Céline Fotso" simule une livraison vers "Douala / Akwa" de deux colis de 2 kg et de 31 kg
    Alors le colis de 31 kg est signalé hors barème
    Et aucun total indicatif n'est donné

  @alternatif @RG-05-06-05
  Scénario: Une zone sans tarif ne donne aucun prix
    Quand "Céline Fotso" simule une livraison vers "Douala / Deïdo" d'un colis de 1 kg
    Alors le résultat indique « aucun tarif pour cette zone »

  @alternatif @RG-05-06-05
  Scénario: Une agence sans grille ne donne aucun prix
    Étant donné l'agence "Rapide Yaoundé" sans grille tarifaire, dont "Ibrahim Bello" est propriétaire
    Quand "Ibrahim Bello" simule une livraison vers "Yaoundé" d'un colis de 1 kg
    Alors le résultat indique « aucun tarif pour cette zone »

  @alternatif @RG-05-06-06
  Scénario: Une simulation n'enregistre rien
    Quand "Céline Fotso" simule une livraison vers "Douala / Akwa" d'un colis de 1 kg
    Alors aucun devis n'est créé pour "Express Douala"
    Et aucune trace n'est ajoutée au journal d'audit

  @erreur @RG-05-06-07 @RM-05-03
  Plan du scénario: Un poids sans unité explicite ou hors bornes est refusé
    Quand "Céline Fotso" simule une livraison vers "Douala / Akwa" d'un colis de "<poids>"
    Alors la simulation est refusée comme invalide

    Exemples:
      | poids    |
      | 2        |
      | 2 lb     |
      | 0 kg     |
      | -1 kg    |
      | 1001 kg  |

  @erreur @RG-05-06-07
  Plan du scénario: Le nombre de colis est borné
    Quand "Céline Fotso" simule une livraison vers "Douala / Akwa" de <nombre> colis de 1 kg
    Alors la simulation est <résultat>

    Exemples:
      | nombre | résultat           |
      | 0      | refusée            |
      | 1      | acceptée           |
      | 20     | acceptée           |
      | 21     | refusée            |

  @erreur @securite @RG-05-06-08 @RM-05-05
  Scénario: La zone d'une autre agence est introuvable
    Étant donné l'agence "Rapide Yaoundé" dessert la zone "Yaoundé / Bastos"
    Quand "Céline Fotso" simule, au nom de "Express Douala", une livraison vers "Yaoundé / Bastos"
    Alors la zone lui est introuvable

  @erreur @securite @RG-05-06-08 @EX-05-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" simule une livraison vers "Douala / Akwa" pour "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable

    Exemples:
      | personne      | situation                                                   |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"       |

  @erreur @RG-05-06-07 @RM-05-03
  Scénario: Des dimensions incomplètes sont refusées
    Quand "Céline Fotso" simule une livraison vers "Douala / Akwa" d'un colis de 1 kg mesurant 30 × 20 cm
    Alors la simulation est refusée comme invalide
