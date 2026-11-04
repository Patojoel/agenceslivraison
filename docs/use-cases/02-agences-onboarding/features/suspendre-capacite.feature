# language: fr
@UC-02-07 @B2.7
Fonctionnalité: Suspendre une capacité
  Afin de ne plus recevoir de nouvelles demandes pour un service interrompu
  En tant que propriétaire ou administrateur d'agence
  Je veux suspendre la livraison ou le stockage avec un motif

  Contexte:
    Étant donné l'agence "Express Douala" au statut brouillon
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"

  @nominal @RG-02-07-01 @RM-02-03
  Scénario: Un administrateur suspend la livraison avec un motif
    Étant donné la capacité livraison de "Express Douala" active
    Quand "Paul Mbarga" suspend la livraison le "2026-11-20" pour le motif "Manque de livreurs"
    Alors la capacité livraison de "Express Douala" est suspendue
    Et la suspension est datée du "2026-11-20", attribuée à "Paul Mbarga", motif "Manque de livreurs"

  @alternatif @RG-02-07-06
  Scénario: Une agence hybride qui suspend le stockage n'est plus hybride
    Étant donné les capacités livraison et stockage de "Express Douala" actives
    Quand "Paul Mbarga" suspend le stockage pour le motif "Entrepôt plein"
    Alors la capacité livraison de "Express Douala" reste active
    Et la capacité stockage est suspendue
    Et "Express Douala" n'est plus présentée comme hybride

  @alternatif @RG-02-07-03 @RM-02-03 @EX-02-007
  Scénario: La suspension conserve l'historique de la capacité
    Étant donné la capacité stockage de "Express Douala" activée le "2026-11-05"
    Quand "Paul Mbarga" suspend le stockage le "2026-11-20" pour le motif "Inventaire annuel"
    Alors l'historique du stockage montre l'activation du "2026-11-05"
    Et l'historique du stockage montre la suspension du "2026-11-20" pour "Inventaire annuel"

  @alternatif @RG-02-07-06
  Scénario: Suspendre la dernière capacité active ne change pas le statut de l'agence
    Étant donné "Express Douala" soumise à vérification
    Et la livraison est la seule capacité active de "Express Douala"
    Quand "Awa Ngono" suspend la livraison pour le motif "Fermeture temporaire"
    Alors "Express Douala" n'a plus aucune capacité active
    Et "Express Douala" reste au statut soumise

  @erreur @RG-02-07-04
  Plan du scénario: Le motif de suspension est obligatoire et borné
    Étant donné la capacité livraison de "Express Douala" active
    Quand "Paul Mbarga" suspend la livraison avec un motif de <longueur> caractères utiles
    Alors la suspension est <résultat>

    Exemples:
      | longueur | résultat |
      | 0        | refusée  |
      | 2        | refusée  |
      | 3        | acceptée |
      | 500      | acceptée |
      | 501      | refusée  |

  @erreur @RG-02-07-05
  Scénario: Une capacité déjà suspendue ne peut pas être suspendue de nouveau
    Étant donné la capacité livraison de "Express Douala" suspendue pour le motif "Manque de livreurs"
    Quand "Paul Mbarga" suspend la livraison pour le motif "Pluies"
    Alors la suspension est refusée pour conflit
    Et le motif de suspension reste "Manque de livreurs"

  @erreur @RG-02-07-01
  Scénario: Une capacité jamais activée ne peut pas être suspendue
    Étant donné la capacité stockage de "Express Douala" n'a jamais été activée
    Quand "Paul Mbarga" suspend le stockage pour le motif "Test"
    Alors la suspension est refusée pour conflit

  @concurrence @RG-02-07-05 @EX-02-004
  Scénario: Deux suspensions simultanées ne produisent qu'une suspension
    Étant donné la capacité livraison de "Express Douala" active
    Quand "Awa Ngono" et "Paul Mbarga" suspendent en même temps la livraison
    Alors la capacité livraison est suspendue une seule fois
    Et le journal d'audit ne contient qu'une seule suspension
    Et l'une des deux demandes est refusée pour conflit

  @erreur @securite @RG-02-07-07 @EX-02-002
  Scénario: Une agente ne peut pas suspendre une capacité
    Étant donné la capacité livraison de "Express Douala" active
    Quand "Céline Fotso" suspend la livraison pour le motif "Trop de travail"
    Alors l'action lui est refusée comme non autorisée
    Et la capacité livraison reste active

  @erreur @securite @RG-02-07-07 @EX-02-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné la capacité livraison de "Express Douala" active
    Et <situation>
    Quand "<personne>" suspend la livraison de "Express Douala" pour le motif "Concurrence"
    Alors l'agence "Express Douala" lui est introuvable
    Et la capacité livraison reste active

    Exemples:
      | personne      | situation                                                    |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement  |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"        |

  @nominal @RG-02-07-07 @EX-02-005
  Scénario: La suspension est tracée dans le journal d'audit
    Étant donné la capacité stockage de "Express Douala" active
    Quand "Paul Mbarga" suspend le stockage pour le motif "Inventaire annuel"
    Alors le journal d'audit contient « capacité suspendue : stockage » avec le motif "Inventaire annuel" par "Paul Mbarga"

  @nominal @RG-02-07-02 @RM-02-03
  Scénario: Une capacité suspendue est signalée comme fermée aux nouvelles demandes
    Étant donné la capacité livraison de "Express Douala" suspendue
    Quand "Céline Fotso" consulte l'état d'onboarding de "Express Douala"
    Alors l'état indique que la livraison n'accepte pas de nouvelles demandes
