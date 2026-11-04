# language: fr
@UC-05-01 @B3.1
Fonctionnalité: Créer une zone tarifaire
  Afin de ne déclarer mes zones qu'une seule fois
  En tant que propriétaire ou administrateur d'agence
  Je veux que chaque zone desservie puisse recevoir un tarif

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification avec la livraison active
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"
    Et la version 1 de la grille de "Express Douala" tarife les zones "Douala / Akwa" et "Douala / Bonabéri"

  @nominal @RG-05-01-01 @D-15
  Scénario: Une zone desservie ajoutée peut recevoir un tarif
    Quand "Paul Mbarga" ajoute la zone desservie "Douala" quartier "Deïdo"
    Alors la zone "Douala / Deïdo" figure parmi les zones tarifables de "Express Douala"
    Et elle porte le même identifiant que la zone desservie

  @alternatif @RG-05-01-02 @RG-05-01-04
  Scénario: Une zone nouvellement ajoutée est sans tarif
    Étant donné "Paul Mbarga" a ajouté la zone desservie "Douala / Deïdo"
    Quand "Céline Fotso" simule le prix d'un colis de 2 kg vers "Douala / Deïdo"
    Alors le résultat indique « aucun tarif pour cette zone »
    Et la version 1 de la grille compte toujours deux zones tarifées

  @erreur @securite @RG-05-01-03 @RM-05-05
  Scénario: La zone d'une autre agence ne devient pas une zone tarifable
    Étant donné l'agence "Rapide Yaoundé" dessert la zone "Yaoundé / Bastos"
    Quand "Paul Mbarga" consulte les zones tarifables de "Express Douala"
    Alors la zone "Yaoundé / Bastos" n'y figure pas
