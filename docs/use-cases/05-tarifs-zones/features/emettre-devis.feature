# language: fr
@UC-05-07 @B3.7
Fonctionnalité: Émettre un devis
  Afin de garantir un prix à un client pendant une durée connue
  En tant que membre d'agence
  Je veux émettre un devis daté

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification avec la livraison active
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"
    Et la version 1 de la grille de "Express Douala" en vigueur :
      | zone              | jusqu'à | prix (FCFA) |
      | Douala / Akwa     | 1 kg    | 1000        |
      | Douala / Akwa     | 5 kg    | 1500        |
      | Douala / Akwa     | 30 kg   | 5000        |
    Et nous sommes le 2026-11-10 à 09:00

  @nominal @RG-05-07-01 @RG-05-07-05 @RG-05-07-06 @RM-05-01
  Scénario: Une agente émet un devis daté
    Quand "Céline Fotso" émet pour "Jean Kamga" un devis de deux colis de 0,8 kg et de 3 kg vers "Douala / Akwa"
    Alors le devis "DEV-2026-000001" est émis pour un total de 2500 FCFA selon la version 1
    Et il est valable jusqu'au 2026-11-17 à 09:00

  @nominal @RG-05-07-02 @RM-05-04
  Scénario: Le devis reprend exactement le prix de la simulation
    Étant donné "Céline Fotso" a simulé deux colis de 0,8 kg et de 3 kg vers "Douala / Akwa" pour 2500 FCFA
    Quand "Céline Fotso" émet pour "Jean Kamga" un devis pour ces mêmes colis
    Alors le total du devis est de 2500 FCFA

  @alternatif @RG-05-07-03
  Scénario: Un prix négocié est retenu avec son motif
    Quand "Céline Fotso" émet pour "Jean Kamga" un devis de deux colis de 0,8 kg et de 3 kg vers "Douala / Akwa" au prix retenu de 2000 FCFA avec le motif "client régulier"
    Alors le devis indique un prix calculé de 2500 FCFA et un prix retenu de 2000 FCFA
    Et le motif "client régulier" est conservé

  @alternatif @RG-05-07-03
  Scénario: Un colis hors barème peut être chiffré à la main
    Quand "Céline Fotso" émet pour "Jean Kamga" un devis d'un colis de 31 kg vers "Douala / Akwa" au prix retenu de 7000 FCFA avec le motif "gros colis"
    Alors le devis est émis pour un total de 7000 FCFA
    Et il indique que le colis était hors barème

  @erreur @RG-05-07-03
  Plan du scénario: Un devis sans prix possible ou sans motif est refusé
    Quand "Céline Fotso" émet pour "Jean Kamga" un devis <situation>
    Alors l'émission est refusée comme invalide
    Et aucun devis n'est créé

    Exemples:
      | situation                                                          |
      | d'un colis de 31 kg vers "Douala / Akwa" sans prix retenu          |
      | d'un colis de 1 kg vers "Douala / Deïdo" sans tarif ni prix retenu |
      | au prix retenu de 2000 FCFA sans motif                             |

  @erreur @RG-05-07-04
  Scénario: Aucun devis n'est émis quand la livraison est suspendue
    Étant donné la capacité livraison de "Express Douala" est suspendue
    Quand "Céline Fotso" émet pour "Jean Kamga" un devis d'un colis de 1 kg vers "Douala / Akwa"
    Alors l'émission est refusée car la livraison n'est pas active

  @erreur @RG-05-07-08
  Plan du scénario: Un destinataire invalide est refusé
    Quand "Céline Fotso" émet un devis pour le destinataire "<nom>" au téléphone "<téléphone>"
    Alors l'émission est refusée comme invalide

    Exemples:
      | nom         | téléphone         |
      | J           | +237699001122     |
      | Jean Kamga  | +33612345678      |

  @alternatif @RG-05-07-07 @EX-05-010
  Scénario: Un double envoi avec la même référence ne crée qu'un devis
    Étant donné "Céline Fotso" a émis le devis "DEV-2026-000003" avec la référence d'envoi "k-2026-11-10-01"
    Quand "Céline Fotso" renvoie le même devis avec la référence d'envoi "k-2026-11-10-01"
    Alors le devis "DEV-2026-000003" lui est renvoyé
    Et aucun autre devis n'est créé

  @erreur @RG-05-07-07 @EX-05-010
  Scénario: La même référence d'envoi pour un autre devis est refusée
    Étant donné "Céline Fotso" a émis un devis avec la référence d'envoi "k-2026-11-10-01"
    Quand "Céline Fotso" émet un devis différent avec la référence d'envoi "k-2026-11-10-01"
    Alors l'émission est refusée pour conflit

  @concurrence @RG-05-07-06 @EX-05-004
  Scénario: Deux devis émis en même temps reçoivent des références distinctes
    Quand "Awa Ngono" et "Céline Fotso" émettent chacune un devis en même temps
    Alors deux devis sont émis avec des références différentes

  @erreur @securite @RG-05-07-09 @RM-05-05
  Scénario: La zone d'une autre agence est introuvable
    Étant donné l'agence "Rapide Yaoundé" dessert la zone "Yaoundé / Bastos"
    Quand "Céline Fotso" émet, au nom de "Express Douala", un devis vers "Yaoundé / Bastos"
    Alors la zone lui est introuvable
    Et aucun devis n'est créé

  @erreur @securite @RG-05-07-09 @EX-05-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" émet un devis pour "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable

    Exemples:
      | personne      | situation                                                   |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"       |

  @erreur @securite @RG-05-07-09 @RM-05-05
  Scénario: Le devis d'une autre agence est introuvable
    Étant donné le devis "DEV-2026-000001" émis par "Rapide Yaoundé"
    Quand "Awa Ngono" consulte, au nom de "Express Douala", ce devis de "Rapide Yaoundé"
    Alors le devis lui est introuvable

  @alternatif @RG-05-07-05
  Scénario: Un devis dont la validité est dépassée apparaît expiré
    Étant donné le devis "DEV-2026-000001" émis le 2026-11-10 à 09:00 et non accepté
    Quand "Céline Fotso" consulte le devis le 2026-11-17 à 09:01
    Alors le devis apparaît comme expiré

  @nominal @RG-05-07-10 @RG-05-07-08 @EX-05-005
  Scénario: L'émission est tracée sans données du destinataire
    Quand "Céline Fotso" émet pour "Jean Kamga" un devis d'un colis de 1 kg vers "Douala / Akwa"
    Alors le journal d'audit contient « devis émis » par "Céline Fotso" pour ce devis
    Et la trace ne contient ni le nom ni le téléphone du destinataire, ni aucun montant
