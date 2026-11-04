# language: fr
@UC-02-02 @B2.2
Fonctionnalité: Compléter l'identité de l'agence
  Afin de pouvoir soumettre mon agence à vérification
  En tant que propriétaire ou administrateur d'agence
  Je veux compléter son identité

  Contexte:
    Étant donné l'agence "Express Douala" au statut brouillon
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"

  @nominal @RG-02-02-01 @UC-02-02
  Scénario: La propriétaire complète l'identité de son agence
    Quand "Awa Ngono" enregistre l'identité suivante pour "Express Douala" :
      | champ               | valeur                                  |
      | raison sociale      | Express Douala SARL                     |
      | ville du siège      | Douala                                  |
      | adresse du siège    | Rue Joss, face pharmacie du Rond-point  |
      | téléphone principal | 6 77 12 34 56                           |
    Alors l'identité de "Express Douala" comporte la raison sociale "Express Douala SARL"
    Et le téléphone principal enregistré est "+237677123456"
    Et la version de "Express Douala" a augmenté de 1

  @nominal @RG-02-02-07
  Scénario: Un administrateur complète l'identité de l'agence
    Quand "Paul Mbarga" enregistre la ville du siège "Douala" pour "Express Douala"
    Alors la ville du siège de "Express Douala" est "Douala"

  @alternatif @RG-02-02-02
  Scénario: Une modification partielle conserve les autres données
    Étant donné l'identité de "Express Douala" avec la raison sociale "Express Douala SARL"
    Quand "Paul Mbarga" enregistre seulement le téléphone principal "6 99 00 11 22"
    Alors le téléphone principal de "Express Douala" est "+237699001122"
    Et la raison sociale reste "Express Douala SARL"

  @alternatif @RG-02-02-04
  Plan du scénario: Le téléphone principal est enregistré sous sa forme normalisée
    Quand "Awa Ngono" enregistre le téléphone principal "<saisi>"
    Alors le téléphone principal enregistré est "<enregistré>"

    Exemples:
      | saisi              | enregistré    |
      | 6 77 12 34 56      | +237677123456 |
      | +237 2 33 42 11 00 | +237233421100 |

  @erreur @RG-02-02-04
  Plan du scénario: Un téléphone principal non camerounais ou incomplet est refusé
    Quand "Awa Ngono" enregistre le téléphone principal "<saisi>"
    Alors l'enregistrement est refusé
    Et le motif indiqué porte sur le téléphone principal

    Exemples:
      | saisi             |
      | 677 12 34         |
      | 5 77 12 34 56     |
      | +33 6 12 34 56 78 |

  @erreur @RG-02-02-03
  Plan du scénario: Bornes de longueur de la raison sociale
    Quand "Awa Ngono" enregistre une raison sociale de <longueur> caractères utiles
    Alors l'enregistrement est <résultat>

    Exemples:
      | longueur | résultat |
      | 1        | refusé   |
      | 2        | accepté  |
      | 200      | accepté  |
      | 201      | refusé   |

  @erreur @RG-02-02-05
  Scénario: Un e-mail de contact invalide est refusé
    Quand "Awa Ngono" enregistre l'e-mail de contact "contact@"
    Alors l'enregistrement est refusé
    Et le motif indiqué porte sur l'e-mail de contact
    Et l'identité de "Express Douala" est inchangée

  @erreur @RG-02-02-06 @RM-02-01
  Scénario: L'identité d'une agence soumise ne peut plus être modifiée
    Étant donné "Express Douala" soumise à vérification
    Quand "Awa Ngono" enregistre la raison sociale "Express Cameroun SARL"
    Alors l'enregistrement est refusé pour conflit
    Et la raison sociale de "Express Douala" est inchangée

  @erreur @concurrence @RG-02-02-08 @EX-02-012
  Scénario: Une modification fondée sur une version périmée est refusée
    Étant donné "Awa Ngono" et "Paul Mbarga" ont consulté la version 3 de "Express Douala"
    Et "Paul Mbarga" a enregistré la ville du siège "Douala" sur la version 3
    Quand "Awa Ngono" enregistre la ville du siège "Edéa" sur la version 3
    Alors l'enregistrement est refusé pour conflit
    Et la ville du siège de "Express Douala" reste "Douala"

  @erreur @securite @RG-02-02-07 @EX-02-002
  Scénario: Une agente ne peut pas modifier l'identité de l'agence
    Quand "Céline Fotso" enregistre la raison sociale "Fotso SARL"
    Alors l'action lui est refusée comme non autorisée
    Et l'identité de "Express Douala" est inchangée

  @erreur @securite @RG-02-02-07 @EX-02-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" enregistre la raison sociale "Autre SARL" pour "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable
    Et aucune donnée de "Express Douala" ne lui est renvoyée

    Exemples:
      | personne      | situation                                                    |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement  |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"        |

  @erreur @securite @EX-02-003
  Scénario: Le statut ne peut pas être modifié avec l'identité
    Quand "Awa Ngono" enregistre la raison sociale "Express Douala SARL" en indiquant le statut "approuvée"
    Alors l'enregistrement est refusé
    Et "Express Douala" reste au statut brouillon

  @nominal @RG-02-02-09 @EX-02-005
  Scénario: La modification de l'identité est tracée sans ses valeurs
    Quand "Paul Mbarga" enregistre le téléphone principal "6 99 00 11 22"
    Alors le journal d'audit contient « identité modifiée : téléphone principal » par "Paul Mbarga"
    Et la trace ne contient pas le numéro de téléphone
