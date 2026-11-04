# language: fr
@UC-05-03 @B3.3
Fonctionnalité: Désactiver une zone tarifaire
  Afin de ne plus m'engager sur un secteur que je ne couvre plus
  En tant que propriétaire ou administrateur d'agence
  Je veux qu'une zone retirée ne puisse plus être chiffrée ni vendue

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification avec la livraison active
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"
    Et "Express Douala" dessert les zones actives "Douala / Akwa" et "Douala / Bonabéri"
    Et la version 1 de la grille tarife "Douala / Bonabéri" à 1 500 FCFA jusqu'à 1 kg

  @erreur @RG-05-03-02 @RM-05-02
  Scénario: Une zone retirée ne peut plus être simulée
    Étant donné "Paul Mbarga" a retiré la zone "Douala / Bonabéri"
    Quand "Céline Fotso" simule le prix d'un colis de 1 kg vers "Douala / Bonabéri"
    Alors la simulation est refusée car la zone est retirée

  @erreur @RG-05-03-02 @RM-05-02
  Scénario: Aucun devis n'est émis vers une zone retirée
    Étant donné "Paul Mbarga" a retiré la zone "Douala / Bonabéri"
    Quand "Céline Fotso" émet un devis d'un colis de 1 kg vers "Douala / Bonabéri"
    Alors l'émission est refusée car la zone est retirée
    Et aucun devis n'est créé

  @erreur @RG-05-03-03 @RM-05-02
  Scénario: Un devis émis avant le retrait ne peut plus être accepté
    Étant donné le devis "DEV-2026-000002" émis vers "Douala / Bonabéri" et non accepté
    Et "Paul Mbarga" a retiré ensuite la zone "Douala / Bonabéri"
    Quand "Céline Fotso" enregistre l'acceptation du devis "DEV-2026-000002"
    Alors l'acceptation est refusée car la zone est retirée
    Et le devis "DEV-2026-000002" reste non accepté

  @alternatif @RG-05-03-04 @RM-05-01
  Scénario: Un devis accepté avant le retrait est inchangé
    Étant donné le devis "DEV-2026-000001" accepté à 1 500 FCFA vers "Douala / Bonabéri"
    Quand "Paul Mbarga" retire la zone "Douala / Bonabéri"
    Alors le devis "DEV-2026-000001" reste accepté à 1 500 FCFA

  @alternatif @RG-05-03-05 @EX-05-008
  Scénario: Une zone réactivée retrouve son tarif
    Étant donné "Paul Mbarga" a retiré puis réactivé la zone "Douala / Bonabéri"
    Quand "Céline Fotso" simule le prix d'un colis de 1 kg vers "Douala / Bonabéri"
    Alors le prix indicatif est de 1 500 FCFA selon la version 1

  @alternatif @RG-05-03-06
  Scénario: Une zone retirée disparaît de la fiche publique
    Étant donné la fiche publique "express-douala" publiée
    Quand "Paul Mbarga" retire la zone "Douala / Bonabéri"
    Alors la fiche publique "express-douala" ne mentionne plus "Douala / Bonabéri"
    Et elle mentionne toujours "Douala / Akwa"

  @concurrence @RG-05-03-07 @EX-05-004
  Scénario: Un retrait et une émission de devis simultanés ne produisent jamais de devis sur une zone déjà retirée
    Quand "Paul Mbarga" retire la zone "Douala / Bonabéri" pendant que "Céline Fotso" émet un devis vers cette zone
    Alors soit le devis est refusé, soit il a été émis avant le retrait et ne peut plus être accepté
