# language: fr
@UC-05-04 @B3.4
Fonctionnalité: Créer la grille tarifaire
  Afin de chiffrer mes livraisons de la même façon pour tous mes clients
  En tant que propriétaire ou administrateur d'agence
  Je veux saisir mes prix de livraison par zone et par tranche de poids

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification avec la livraison active
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"
    Et "Express Douala" dessert les zones actives "Douala / Akwa", "Douala / Bonabéri" et "Douala / Deïdo"
    Et "Express Douala" n'a pas encore de grille tarifaire

  @nominal @RG-05-04-01 @RG-05-04-02
  Scénario: Un administrateur crée la grille de l'agence
    Quand "Paul Mbarga" crée la grille de "Express Douala" avec le barème :
      | zone              | jusqu'à | prix (FCFA) |
      | Douala / Akwa     | 1 kg    | 1000        |
      | Douala / Akwa     | 5 kg    | 1500        |
      | Douala / Akwa     | 10 kg   | 2500        |
      | Douala / Akwa     | 30 kg   | 5000        |
      | Douala / Bonabéri | 1 kg    | 1500        |
      | Douala / Bonabéri | 5 kg    | 2000        |
      | Douala / Bonabéri | 10 kg   | 3000        |
    Alors "Express Douala" a une grille dont la version 1 est en vigueur
    Et la version 1 tarife les zones "Douala / Akwa" et "Douala / Bonabéri"

  @alternatif @RG-05-04-03 @RM-05-03
  Plan du scénario: Une borne en grammes équivaut à la même borne en kilogrammes
    Quand "Paul Mbarga" crée la grille avec la tranche "<borne>" à 1000 FCFA pour "Douala / Akwa"
    Alors la tranche de "Douala / Akwa" s'arrête à 1 000 grammes

    Exemples:
      | borne   |
      | 1 kg    |
      | 1000 g  |
      | 1,0 kg  |

  @alternatif @RG-05-04-05 @RM-05-03
  Scénario: Une grille peut appliquer un poids volumétrique
    Quand "Paul Mbarga" crée la grille avec un diviseur volumétrique de 5000 et la tranche "1 kg" à 1000 FCFA pour "Douala / Akwa"
    Alors la version 1 applique un poids volumétrique de diviseur 5000 aux dimensions en centimètres

  @alternatif @RG-05-04-07
  Scénario: Une zone active absente du barème reste sans tarif
    Quand "Paul Mbarga" crée la grille en tarifant seulement "Douala / Akwa"
    Alors la zone "Douala / Deïdo" est sans tarif dans la version 1

  @erreur @RG-05-04-03 @RM-05-03
  Plan du scénario: Une borne sans unité explicite est refusée
    Quand "Paul Mbarga" crée la grille avec la tranche "<borne>" à 1000 FCFA pour "Douala / Akwa"
    Alors la création est refusée comme invalide
    Et "Express Douala" n'a toujours pas de grille

    Exemples:
      | borne     |
      | 1         |
      | 1 lb      |
      | 1 kilo    |
      | 0,5 g     |
      | 1001 kg   |

  @erreur @RG-05-04-02
  Plan du scénario: Des tranches non croissantes sont refusées
    Quand "Paul Mbarga" crée la grille avec les tranches "<tranches>" pour "Douala / Akwa"
    Alors la création est refusée comme invalide

    Exemples:
      | tranches                          |
      | 5 kg à 1500 puis 1 kg à 1000      |
      | 1 kg à 1000 puis 1000 g à 1500    |

  @erreur @RG-05-04-04 @RM-05-04
  Plan du scénario: Un prix hors règle est refusé
    Quand "Paul Mbarga" crée la grille avec la tranche "1 kg" au prix "<prix>" pour "Douala / Akwa"
    Alors la création est refusée comme invalide

    Exemples:
      | prix          |
      | 0 FCFA        |
      | -500 FCFA     |
      | 1000,50 FCFA  |
      | 10000001 FCFA |
      | 10 EUR        |

  @erreur @RG-05-04-06
  Scénario: Une zone retirée ne peut pas être tarifée
    Étant donné la zone "Douala / Bépanda" retirée de "Express Douala"
    Quand "Paul Mbarga" crée la grille avec la tranche "1 kg" à 1000 FCFA pour "Douala / Bépanda"
    Alors la création est refusée car la zone est retirée

  @erreur @RG-05-04-07
  Scénario: Une zone ne peut figurer que sur une ligne
    Quand "Paul Mbarga" crée la grille avec deux lignes distinctes pour "Douala / Akwa"
    Alors la création est refusée comme invalide

  @erreur @RG-05-04-01
  Scénario: Une seconde grille est refusée
    Étant donné "Express Douala" a déjà une grille en version 1
    Quand "Awa Ngono" crée une nouvelle grille pour "Express Douala"
    Alors la création est refusée pour conflit
    Et la grille existante reste en version 1

  @concurrence @RG-05-04-12 @EX-05-004
  Scénario: Deux créations simultanées ne produisent qu'une grille
    Quand "Awa Ngono" et "Paul Mbarga" créent en même temps la grille de "Express Douala"
    Alors "Express Douala" n'a qu'une grille en version 1
    Et l'une des deux créations est refusée pour conflit

  @erreur @securite @RG-05-04-10 @EX-05-002
  Scénario: Une agente ne peut pas créer la grille
    Quand "Céline Fotso" crée la grille de "Express Douala"
    Alors l'action lui est refusée comme non autorisée
    Et "Express Douala" n'a toujours pas de grille

  @erreur @securite @RG-05-04-10 @EX-05-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" crée la grille de "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable

    Exemples:
      | personne      | situation                                                   |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"       |

  @erreur @securite @RG-05-04-06 @RM-05-05
  Scénario: La zone d'une autre agence ne peut pas être tarifée
    Étant donné l'agence "Rapide Yaoundé" dessert la zone "Yaoundé / Bastos"
    Quand "Paul Mbarga" crée la grille de "Express Douala" avec une ligne pour la zone "Yaoundé / Bastos"
    Alors la zone lui est introuvable
    Et "Express Douala" n'a toujours pas de grille

  @nominal @RG-05-04-11 @EX-05-005
  Scénario: La création de la grille est tracée sans les prix
    Quand "Paul Mbarga" crée la grille de "Express Douala"
    Alors le journal d'audit contient « grille créée, version 1 » par "Paul Mbarga"
    Et la trace ne contient ni prix ni zone
