# language: fr
@UC-05-05 @B3.5
Fonctionnalité: Versionner la grille tarifaire
  Afin d'ajuster mes prix sans modifier ce que j'ai déjà promis
  En tant que propriétaire ou administrateur d'agence
  Je veux publier une nouvelle version de ma grille

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification avec la livraison active
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"
    Et la version 1 de la grille de "Express Douala" en vigueur, créée par "Paul Mbarga" :
      | zone              | jusqu'à | prix (FCFA) |
      | Douala / Akwa     | 1 kg    | 1000        |
      | Douala / Akwa     | 5 kg    | 1500        |
      | Douala / Bonabéri | 1 kg    | 1500        |

  @nominal @RG-05-05-01
  Scénario: Une nouvelle version entre en vigueur et l'ancienne est historisée
    Quand "Paul Mbarga" publie, sur la base de la version 1, un barème où "Douala / Akwa" jusqu'à 1 kg coûte 1200 FCFA
    Alors la version 2 est en vigueur
    Et la version 1 reste consultable avec "Douala / Akwa" jusqu'à 1 kg à 1000 FCFA

  @nominal @RG-05-05-06
  Scénario: Une simulation utilise la version en vigueur
    Étant donné la version 2 en vigueur où "Douala / Akwa" jusqu'à 1 kg coûte 1200 FCFA
    Quand "Céline Fotso" simule le prix d'un colis de 1 kg vers "Douala / Akwa"
    Alors le prix indicatif est de 1200 FCFA selon la version 2

  @alternatif @RG-05-05-03 @RM-05-01
  Scénario: Un devis émis garde son prix après une nouvelle version
    Étant donné le devis "DEV-2026-000001" émis sous la version 1 pour un total de 2500 FCFA
    Quand "Paul Mbarga" publie la version 2 où "Douala / Akwa" jusqu'à 1 kg coûte 1200 FCFA
    Alors le devis "DEV-2026-000001" reste à 2500 FCFA selon la version 1

  @alternatif @RG-05-05-03 @RM-05-01
  Scénario: Un devis accepté n'est jamais recalculé
    Étant donné le devis "DEV-2026-000001" accepté à 2500 FCFA sous la version 1
    Et "Paul Mbarga" a publié les versions 2 et 3
    Quand "Céline Fotso" consulte le devis "DEV-2026-000001"
    Alors le devis est accepté à 2500 FCFA selon la version 1

  @alternatif @RG-05-05-07
  Scénario: Une agente consulte l'historique des versions
    Étant donné "Paul Mbarga" a publié la version 2
    Quand "Céline Fotso" consulte l'historique de la grille de "Express Douala"
    Alors elle voit la version 2 puis la version 1, chacune avec sa date, son auteur et son barème

  @alternatif @RG-05-05-05
  Scénario: Un barème identique ne crée pas de version
    Quand "Paul Mbarga" publie, sur la base de la version 1, un barème identique à la version 1
    Alors la version 1 reste en vigueur
    Et aucune trace n'est ajoutée au journal d'audit

  @erreur @RG-05-05-02
  Scénario: Une version fondée sur une version périmée est refusée
    Étant donné "Paul Mbarga" a publié la version 2 sur la base de la version 1
    Quand "Awa Ngono" publie un barème sur la base de la version 1
    Alors la publication est refusée pour conflit de version
    Et la version 2 reste en vigueur

  @concurrence @RG-05-05-02 @EX-05-004
  Scénario: Deux versions simultanées sur la même base n'en produisent qu'une
    Quand "Awa Ngono" et "Paul Mbarga" publient en même temps un barème différent sur la base de la version 1
    Alors une seule version 2 existe
    Et l'autre publication est refusée pour conflit de version

  @erreur @RG-05-05-04 @RM-05-03
  Scénario: Une version invalide est refusée et la précédente reste en vigueur
    Quand "Paul Mbarga" publie, sur la base de la version 1, une tranche "5" sans unité pour "Douala / Akwa"
    Alors la publication est refusée comme invalide
    Et la version 1 reste en vigueur

  @erreur @securite @RG-05-05-08 @EX-05-002
  Scénario: Une agente ne peut pas versionner la grille
    Quand "Céline Fotso" publie un barème sur la base de la version 1
    Alors l'action lui est refusée comme non autorisée
    Et la version 1 reste en vigueur

  @erreur @securite @RG-05-05-08 @RM-05-05
  Scénario: La grille d'une autre agence est introuvable
    Quand "Ibrahim Bello", propriétaire de "Rapide Yaoundé" uniquement, publie un barème pour la grille de "Express Douala"
    Alors la grille lui est introuvable
    Et la version 1 reste en vigueur

  @erreur @securite @RG-05-05-08 @EX-05-001
  Scénario: Un ancien membre ne trouve plus la grille
    Étant donné "Jean Etoa" ancien administrateur de "Express Douala"
    Quand "Jean Etoa" consulte l'historique de la grille de "Express Douala"
    Alors la grille lui est introuvable

  @erreur @RG-05-05-08
  Scénario: Une agence sans grille ne peut pas versionner
    Étant donné l'agence "Rapide Yaoundé" sans grille tarifaire
    Quand "Ibrahim Bello" publie un barème sur la base de la version 1 pour "Rapide Yaoundé"
    Alors la grille lui est introuvable

  @nominal @RG-05-05-09 @EX-05-005
  Scénario: Une nouvelle version est tracée sans les prix
    Quand "Paul Mbarga" publie la version 2 sur la base de la version 1
    Alors le journal d'audit contient « grille versionnée, version 2 » par "Paul Mbarga"
    Et la trace ne contient ni prix ni zone
