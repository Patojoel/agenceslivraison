# language: fr
@UC-02-05 @B2.5
Fonctionnalité: Soumettre l'agence à vérification
  Afin que la plateforme examine mon agence
  En tant que propriétaire d'agence
  Je veux soumettre mon agence à vérification

  Contexte:
    Étant donné l'agence "Express Douala" au statut brouillon
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"

  @nominal @RG-02-05-01 @RG-02-05-02 @RM-02-01
  Scénario: La propriétaire soumet une agence dont le dossier est complet
    Étant donné "Express Douala" a une identité complète
    Et la capacité livraison de "Express Douala" est active
    Et "Express Douala" possède le site actif "Agence Akwa"
    Quand "Awa Ngono" soumet "Express Douala" à vérification le "2026-11-15"
    Alors "Express Douala" est au statut soumise
    Et la soumission est datée du "2026-11-15" et attribuée à "Awa Ngono"

  @nominal @RG-02-05-06 @RM-02-04
  Scénario: Une agence soumise n'est présentée ni comme vérifiée ni comme assurée
    Étant donné "Express Douala" soumise à vérification
    Quand "Awa Ngono" consulte l'état d'onboarding de "Express Douala"
    Alors l'état indique « soumise à vérification »
    Et aucune mention de vérification acquise, de certification ou d'assurance n'apparaît

  @erreur @RG-02-05-02 @RM-02-02
  Plan du scénario: Une agence dont un prérequis manque n'est pas soumise
    Étant donné "Express Douala" a un dossier complet sauf <élément manquant>
    Quand "Awa Ngono" soumet "Express Douala" à vérification
    Alors la soumission est refusée
    Et le motif liste « <élément manquant> »
    Et "Express Douala" reste au statut brouillon

    Exemples:
      | élément manquant          |
      | raison sociale            |
      | ville du siège            |
      | adresse du siège          |
      | téléphone principal       |
      | au moins une capacité active |
      | au moins un site actif    |

  @erreur @RG-02-05-03
  Scénario: Tous les prérequis manquants sont listés en une fois
    Étant donné "Express Douala" n'a ni téléphone principal ni site actif
    Et la capacité livraison de "Express Douala" est active
    Quand "Awa Ngono" soumet "Express Douala" à vérification
    Alors la soumission est refusée
    Et le motif liste « téléphone principal » et « au moins un site actif »

  @erreur @RG-02-05-02 @RM-02-03
  Scénario: Une capacité suspendue ne permet pas de soumettre
    Étant donné "Express Douala" a une identité complète et le site actif "Agence Akwa"
    Et la capacité livraison de "Express Douala" est suspendue
    Et la capacité stockage de "Express Douala" n'a jamais été activée
    Quand "Awa Ngono" soumet "Express Douala" à vérification
    Alors la soumission est refusée
    Et le motif liste « au moins une capacité active »

  @erreur @RG-02-05-04 @RG-02-05-08
  Scénario: Une agence déjà soumise ne peut pas être soumise de nouveau
    Étant donné "Express Douala" soumise à vérification le "2026-11-15"
    Quand "Awa Ngono" soumet "Express Douala" à vérification le "2026-11-16"
    Alors la soumission est refusée pour conflit
    Et la soumission reste datée du "2026-11-15"

  @concurrence @RG-02-05-04 @EX-02-004
  Scénario: Deux soumissions simultanées ne produisent qu'une soumission
    Étant donné "Express Douala" a un dossier complet
    Quand deux soumissions de "Express Douala" par "Awa Ngono" arrivent en même temps
    Alors "Express Douala" est au statut soumise
    Et le journal d'audit ne contient qu'une seule soumission
    Et l'une des deux demandes est refusée pour conflit

  @erreur @securite @RG-02-05-05 @EX-02-002
  Plan du scénario: Seule la propriétaire peut soumettre l'agence
    Étant donné "Express Douala" a un dossier complet
    Quand "<personne>" soumet "Express Douala" à vérification
    Alors l'action lui est refusée comme non autorisée
    Et "Express Douala" reste au statut brouillon

    Exemples:
      | personne     |
      | Paul Mbarga  |
      | Céline Fotso |

  @erreur @securite @RG-02-05-05 @EX-02-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" soumet "Express Douala" à vérification
    Alors l'agence "Express Douala" lui est introuvable
    Et "Express Douala" reste au statut brouillon

    Exemples:
      | personne      | situation                                                    |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement  |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"        |

  @erreur @securite @RG-02-05-01 @EX-02-003 @EX-02-006
  Scénario: La soumission ne permet pas d'imposer un autre statut
    Étant donné "Express Douala" a un dossier complet
    Quand "Awa Ngono" soumet "Express Douala" en indiquant le statut "approuvée"
    Alors la soumission est refusée
    Et "Express Douala" reste au statut brouillon

  @nominal @RG-02-05-07 @EX-02-005 @EX-02-010
  Scénario: La soumission est tracée dans le journal d'audit
    Étant donné "Express Douala" a un dossier complet
    Quand "Awa Ngono" soumet "Express Douala" à vérification
    Alors le journal d'audit contient « agence soumise à vérification » par "Awa Ngono"
