# language: fr
@UC-02-09 @B2.9
Fonctionnalité: Consulter l'état d'onboarding
  Afin de savoir ce qui reste à faire avant la soumission
  En tant que membre d'une agence
  Je veux voir l'état d'onboarding de mon agence

  Contexte:
    Étant donné l'agence "Express Douala" au statut brouillon
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"

  @nominal @RG-02-09-01 @RG-02-09-02 @RM-02-02
  Scénario: Un brouillon incomplet montre les prérequis manquants
    Étant donné "Express Douala" a une identité complète sauf le téléphone principal
    Et la capacité livraison de "Express Douala" est active avec la zone "Douala / Akwa"
    Et "Express Douala" ne possède aucun site actif
    Quand "Awa Ngono" consulte l'état d'onboarding de "Express Douala"
    Alors le statut affiché est brouillon
    Et les prérequis manquants sont « téléphone principal » et « au moins un site actif »
    Et l'agence n'est pas prête à être soumise

  @nominal @RG-02-09-02
  Scénario: Un brouillon complet est prêt à être soumis
    Étant donné "Express Douala" a un dossier complet
    Quand "Awa Ngono" consulte l'état d'onboarding de "Express Douala"
    Alors aucun prérequis ne manque
    Et l'agence est prête à être soumise

  @alternatif @RG-02-09-04 @RM-02-04
  Scénario: Une agence soumise est présentée comme soumise à vérification, sans garantie
    Étant donné "Express Douala" soumise à vérification le "2026-11-15" par "Awa Ngono"
    Quand "Awa Ngono" consulte l'état d'onboarding de "Express Douala"
    Alors l'état indique « soumise à vérification » depuis le "2026-11-15" par "Awa Ngono"
    Et aucune mention de vérification acquise, de certification ou d'assurance n'apparaît

  @nominal @RG-02-09-06
  Scénario: Une agente consulte l'état d'onboarding
    Étant donné la capacité livraison de "Express Douala" est active
    Quand "Céline Fotso" consulte l'état d'onboarding de "Express Douala"
    Alors elle voit le statut brouillon et la livraison active

  @alternatif @RG-02-09-03 @RM-02-03
  Scénario: Une capacité suspendue apparaît fermée aux nouvelles demandes
    Étant donné les capacités livraison et stockage de "Express Douala" actives
    Et la livraison suspendue le "2026-11-20" pour le motif "Manque de livreurs"
    Quand "Awa Ngono" consulte l'état d'onboarding de "Express Douala"
    Alors la livraison apparaît suspendue depuis le "2026-11-20" pour "Manque de livreurs"
    Et la livraison n'accepte pas de nouvelles demandes
    Et "Express Douala" n'est pas présentée comme hybride

  @alternatif @RG-02-09-05 @RM-02-01
  Scénario: Un brouillon ancien reste un brouillon
    Étant donné "Express Douala" créée le "2026-08-01" et jamais soumise
    Quand "Awa Ngono" consulte l'état d'onboarding le "2026-11-04"
    Alors le statut affiché est brouillon

  @erreur @securite @RG-02-09-06 @EX-02-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'état d'onboarding
    Étant donné <situation>
    Quand "<personne>" consulte l'état d'onboarding de "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable
    Et aucune donnée de "Express Douala" ne lui est renvoyée

    Exemples:
      | personne      | situation                                                    |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement  |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"        |

  @erreur @securite @EX-02-013
  Scénario: Un visiteur non connecté ne peut pas consulter l'état d'onboarding
    Étant donné un visiteur non connecté
    Quand le visiteur consulte l'état d'onboarding de "Express Douala"
    Alors une connexion lui est demandée
    Et aucune donnée de "Express Douala" ne lui est renvoyée

  @nominal @securite @RG-02-09-06
  Scénario: L'état indique les prérequis remplis sans en révéler les valeurs
    Étant donné "Express Douala" a le téléphone principal "+237677123456"
    Quand "Céline Fotso" consulte l'état d'onboarding de "Express Douala"
    Alors le prérequis « téléphone principal » apparaît rempli
    Et le numéro "+237677123456" n'apparaît pas dans l'état
