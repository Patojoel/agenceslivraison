# language: fr
@UC-02-04 @B2.4
Fonctionnalité: Activer une capacité livraison ou stockage
  Afin de recevoir des demandes pour les services que j'offre
  En tant que propriétaire ou administrateur d'agence
  Je veux activer la livraison, le stockage ou les deux

  Contexte:
    Étant donné l'agence "Express Douala" au statut brouillon
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"

  @nominal @RG-02-04-01 @RG-02-04-03
  Scénario: Activer la livraison quand une zone est desservie
    Étant donné "Express Douala" dessert la zone active "Douala / Akwa"
    Quand "Paul Mbarga" active la capacité livraison
    Alors la capacité livraison de "Express Douala" est active

  @nominal @RG-02-04-01 @RG-02-04-03
  Scénario: Activer le stockage quand un site est actif
    Étant donné "Express Douala" possède le site actif "Dépôt Bonabéri"
    Quand "Awa Ngono" active la capacité stockage
    Alors la capacité stockage de "Express Douala" est active

  @alternatif @RG-02-04-01
  Scénario: Une agence qui active ses deux capacités devient hybride
    Étant donné la capacité livraison de "Express Douala" active
    Et "Express Douala" possède le site actif "Dépôt Bonabéri"
    Quand "Paul Mbarga" active la capacité stockage
    Alors les capacités livraison et stockage de "Express Douala" sont actives
    Et "Express Douala" est présentée comme hybride

  @alternatif @RG-02-04-04 @RM-02-03
  Scénario: Réactiver une capacité suspendue conserve l'historique de suspension
    Étant donné la capacité stockage de "Express Douala" suspendue le "2026-11-10" pour le motif "Inventaire annuel"
    Et "Express Douala" possède le site actif "Dépôt Bonabéri"
    Quand "Paul Mbarga" active la capacité stockage
    Alors la capacité stockage de "Express Douala" est active
    Et l'historique du stockage montre la suspension du "2026-11-10" pour "Inventaire annuel"

  @erreur @RG-02-04-03 @RM-02-02
  Plan du scénario: Une capacité sans configuration minimale n'est pas activée
    Étant donné "Express Douala" <situation>
    Quand "Paul Mbarga" active la capacité <capacité>
    Alors l'activation est refusée
    Et le motif indique qu'il manque <élément manquant>
    Et la capacité <capacité> de "Express Douala" n'est pas active

    Exemples:
      | capacité  | situation                        | élément manquant                     |
      | livraison | ne dessert aucune zone active    | au moins une zone desservie active   |
      | stockage  | ne possède aucun site actif      | au moins un site actif               |

  @erreur @RG-02-04-05
  Scénario: Activer une capacité déjà active est refusé
    Étant donné la capacité livraison de "Express Douala" active
    Quand "Paul Mbarga" active la capacité livraison
    Alors l'activation est refusée pour conflit
    Et le journal d'audit ne contient qu'une seule activation de la livraison

  @concurrence @RG-02-04-05 @EX-02-004
  Scénario: Deux activations simultanées ne produisent qu'une activation
    Étant donné "Express Douala" dessert la zone active "Douala / Akwa"
    Quand "Awa Ngono" et "Paul Mbarga" activent en même temps la capacité livraison
    Alors la capacité livraison de "Express Douala" est active
    Et une seule activation de la livraison est enregistrée
    Et l'une des deux demandes est refusée pour conflit

  @erreur @RG-02-04-02
  Scénario: Une capacité inconnue est refusée
    Quand "Paul Mbarga" active la capacité "transport aérien"
    Alors l'activation est refusée
    Et aucune capacité de "Express Douala" n'est modifiée

  @erreur @securite @RG-02-04-07 @EX-02-002
  Scénario: Une agente ne peut pas activer une capacité
    Étant donné "Express Douala" dessert la zone active "Douala / Akwa"
    Quand "Céline Fotso" active la capacité livraison
    Alors l'action lui est refusée comme non autorisée
    Et la capacité livraison de "Express Douala" n'est pas active

  @erreur @securite @RG-02-04-07 @EX-02-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" active la capacité livraison de "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable

    Exemples:
      | personne      | situation                                                    |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement  |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"        |

  @alternatif @RG-02-04-07
  Scénario: Une agence soumise peut activer une capacité
    Étant donné "Express Douala" soumise à vérification
    Et "Express Douala" possède le site actif "Dépôt Bonabéri"
    Quand "Paul Mbarga" active la capacité stockage
    Alors la capacité stockage de "Express Douala" est active

  @nominal @RG-02-04-08 @EX-02-005 @EX-02-010
  Scénario: L'activation d'une capacité est tracée dans le journal d'audit
    Étant donné "Express Douala" dessert la zone active "Douala / Akwa"
    Quand "Paul Mbarga" active la capacité livraison
    Alors le journal d'audit contient « capacité activée : livraison » par "Paul Mbarga"

  @concurrence @RG-02-04-06 @RM-02-02
  Scénario: Le retrait de la dernière zone et l'activation de la livraison simultanés restent cohérents
    Étant donné "Express Douala" dessert la seule zone active "Douala / Akwa"
    Quand "Awa Ngono" active la livraison pendant que "Paul Mbarga" retire la zone "Douala / Akwa"
    Alors l'une des deux actions est refusée
    Et "Express Douala" n'a jamais la livraison active sans zone desservie active
