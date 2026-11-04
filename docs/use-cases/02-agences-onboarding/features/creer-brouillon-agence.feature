# language: fr
@UC-02-01 @B2.1
Fonctionnalité: Créer un brouillon d'agence
  Afin de préparer mon activité sur la plateforme
  En tant que personne connectée
  Je veux créer mon agence en brouillon et en devenir propriétaire

  @nominal @RG-02-01-01 @RG-02-01-02 @RG-02-01-03 @RM-02-01 @EX-02-008 @EX-02-009
  Plan du scénario: Une personne connectée crée une agence en brouillon et en devient propriétaire
    Étant donné "<personne>" connectée avec un compte <type de compte> et membre d'aucune agence
    Quand "<personne>" crée l'agence "<nom commercial>"
    Alors l'agence "<nom commercial>" existe au statut brouillon
    Et "<personne>" en est propriétaire active
    Et "<nom commercial>" figure dans les agences de "<personne>" avec le rôle propriétaire

    Exemples:
      | personne     | type de compte | nom commercial    |
      | Awa Ngono    | particulier    | Express Douala    |
      | Marie Tchoua | commerçant     | Tchoua Logistique |

  @nominal @RG-02-01-04
  Scénario: Le nom commercial est enregistré sans ses espaces de bord
    Étant donné "Awa Ngono" connectée et membre d'aucune agence
    Quand "Awa Ngono" crée l'agence "   Express Douala  "
    Alors l'agence créée porte le nom commercial "Express Douala"

  @alternatif @RG-02-01-06 @RM-01-01
  Scénario: Une propriétaire crée une seconde agence
    Étant donné "Awa Ngono" propriétaire active de "Express Douala"
    Quand "Awa Ngono" crée l'agence "Express Kribi"
    Alors l'agence "Express Kribi" existe au statut brouillon
    Et "Awa Ngono" est propriétaire active de "Express Douala" et de "Express Kribi"

  @erreur @RG-02-01-04
  Plan du scénario: Bornes de longueur du nom commercial
    Étant donné "Awa Ngono" connectée et membre d'aucune agence
    Quand "Awa Ngono" crée une agence dont le nom commercial compte <longueur> caractères utiles
    Alors la création est <résultat>

    Exemples:
      | longueur | résultat |
      | 0        | refusée  |
      | 1        | refusée  |
      | 2        | acceptée |
      | 120      | acceptée |
      | 121      | refusée  |

  @erreur @securite @RG-02-01-05 @EX-02-003
  Scénario: Le statut d'une agence ne peut pas être imposé à sa création
    Étant donné "Awa Ngono" connectée et membre d'aucune agence
    Quand "Awa Ngono" crée l'agence "Express Douala" en indiquant le statut "soumise"
    Alors la création est refusée
    Et "Awa Ngono" n'est membre d'aucune agence

  @erreur @securite @EX-02-013
  Scénario: Un visiteur non connecté ne peut pas créer d'agence
    Étant donné un visiteur non connecté
    Quand le visiteur crée l'agence "Express Douala"
    Alors la création est refusée
    Et une connexion lui est demandée

  @erreur @securite @EX-02-013 @RM-01-05
  Scénario: Une session fermée ne permet pas de créer une agence
    Étant donné "Awa Ngono" dont la session a été fermée
    Quand "Awa Ngono" crée l'agence "Express Douala" avec cette session
    Alors la création est refusée
    Et une connexion lui est demandée

  @alternatif @concurrence @RG-02-01-07 @EX-02-004
  Scénario: Une création rejouée avec la même référence d'envoi ne crée qu'une agence
    Étant donné "Awa Ngono" a créé l'agence "Express Douala" avec la référence d'envoi "cle-001"
    Quand "Awa Ngono" renvoie la création de "Express Douala" avec la référence d'envoi "cle-001"
    Alors elle obtient la même agence "Express Douala"
    Et "Awa Ngono" n'est propriétaire que d'une seule agence
    Et le journal d'audit ne contient qu'une seule création

  @concurrence @RG-02-01-07 @EX-02-004
  Scénario: Deux envois simultanés de la même création ne créent qu'une agence
    Étant donné "Awa Ngono" connectée et membre d'aucune agence
    Quand deux créations de "Express Douala" avec la référence d'envoi "cle-002" arrivent en même temps
    Alors une seule agence "Express Douala" existe
    Et les deux réponses désignent cette même agence

  @erreur @RG-02-01-07
  Scénario: Une référence d'envoi réutilisée pour un autre contenu est refusée
    Étant donné "Awa Ngono" a créé l'agence "Express Douala" avec la référence d'envoi "cle-003"
    Quand "Awa Ngono" crée l'agence "Express Kribi" avec la référence d'envoi "cle-003"
    Alors la création est refusée pour conflit
    Et "Awa Ngono" n'est propriétaire que de "Express Douala"

  @alternatif @RG-02-01-07
  Scénario: Sans référence d'envoi, deux créations donnent deux brouillons
    Étant donné "Awa Ngono" a créé l'agence "Express Douala" sans référence d'envoi
    Quand "Awa Ngono" crée de nouveau l'agence "Express Douala" sans référence d'envoi
    Alors "Awa Ngono" est propriétaire de deux agences au statut brouillon nommées "Express Douala"

  @nominal @RG-02-01-08 @EX-02-005 @EX-02-010
  Scénario: La création d'une agence est tracée dans le journal d'audit
    Étant donné "Awa Ngono" connectée et membre d'aucune agence
    Quand "Awa Ngono" crée l'agence "Express Douala"
    Alors le journal d'audit contient « agence créée » pour "Express Douala" par "Awa Ngono"
