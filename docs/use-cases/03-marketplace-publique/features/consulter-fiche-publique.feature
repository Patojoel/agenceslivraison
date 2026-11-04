# language: fr
@UC-03-04 @B3.12
Fonctionnalité: Consulter la fiche publique d'une agence
  Afin de savoir où une agence intervient, ce qu'elle propose et à partir de quel prix
  En tant que visiteur de la marketplace
  Je veux consulter sa fiche publique

  Contexte:
    Étant donné la fiche publique "express-douala" publiée, agence soumise et non approuvée
    Et "Express Douala" a la livraison active, les zones actives "Douala / Akwa" et "Douala / Bonabéri" et le site actif "Agence Akwa" à "Douala"
    Et la version 1 de sa grille tarife "Douala / Akwa" à partir de 1000 FCFA et "Douala / Bonabéri" à partir de 1500 FCFA

  @nominal @RG-03-04-01 @RG-03-04-04 @RG-03-04-05 @RM-03-05
  Scénario: Un visiteur consulte la fiche d'une agence
    Quand un visiteur non connecté consulte la fiche "express-douala"
    Alors il voit le nom "Express Douala", la mention « non vérifiée » et la capacité livraison
    Et il voit les zones "Douala / Akwa" et "Douala / Bonabéri" et la ville "Douala"
    Et il voit « à partir de 1000 FCFA » pour "Douala / Akwa" et « à partir de 1500 FCFA » pour "Douala / Bonabéri"
    Et la mention « Tarifs indicatifs, non garantis sans devis » accompagne les tarifs

  @nominal @securite @RG-03-04-03 @RM-03-01
  Plan du scénario: La fiche n'expose aucune donnée privée
    Étant donné <donnée> de "Express Douala" est renseigné
    Quand un visiteur consulte la fiche "express-douala"
    Alors la fiche ne contient pas <donnée>

    Exemples:
      | donnée                                 |
      | le téléphone principal                 |
      | l'e-mail de contact                    |
      | le RCCM                                |
      | le NIU                                 |
      | l'adresse du siège                     |
      | l'adresse et le téléphone du site      |
      | la liste des membres                   |
      | le motif d'une capacité suspendue      |

  @erreur @securite @RG-03-04-02
  Plan du scénario: Une fiche non visible est introuvable, toujours de la même façon
    Étant donné <situation>
    Quand un visiteur consulte la fiche "<slug>"
    Alors la fiche est introuvable
    Et la réponse est identique à celle d'une adresse qui n'a jamais existé

    Exemples:
      | slug             | situation                                                        |
      | xyz-inconnue     | aucune agence n'a l'adresse "xyz-inconnue"                       |
      | livraison-kribi  | la fiche "livraison-kribi" a été retirée                         |
      | stock-limbe      | la fiche "stock-limbe" publiée dont toutes les capacités sont suspendues |
      | agence-7b2e4a10  | la fiche "agence-7b2e4a10" d'une agence revenue au nom provisoire |
      | Express-Douala   | la fiche "express-douala" existe en minuscules seulement         |

  @alternatif @RG-03-04-04 @RM-05-01
  Scénario: Les tarifs indicatifs suivent la version en vigueur
    Étant donné "Paul Mbarga" a publié la version 2 où "Douala / Akwa" jusqu'à 1 kg coûte 1200 FCFA
    Quand un visiteur consulte la fiche "express-douala"
    Alors il voit « à partir de 1200 FCFA » pour "Douala / Akwa"

  @alternatif @RG-03-04-04
  Scénario: Une agence sans grille affiche des tarifs sur devis
    Étant donné la fiche publique "rapide-yaounde" publiée, sans grille tarifaire
    Quand un visiteur consulte la fiche "rapide-yaounde"
    Alors aucun prix n'est affiché
    Et la fiche indique « tarifs sur devis »

  @alternatif @RG-03-04-07
  Scénario: Une zone retirée n'apparaît plus sur la fiche
    Étant donné "Express Douala" a retiré la zone "Douala / Bonabéri"
    Quand un visiteur consulte la fiche "express-douala"
    Alors la fiche ne mentionne plus "Douala / Bonabéri" ni son tarif

  @alternatif @RG-03-04-07 @RM-02-03
  Scénario: Une capacité suspendue n'apparaît plus sur la fiche
    Étant donné "Express Douala" a aussi la capacité stockage active
    Et "Express Douala" a suspendu son stockage pour "Inventaire annuel"
    Quand un visiteur consulte la fiche "express-douala"
    Alors la fiche indique seulement la capacité livraison
    Et elle ne contient pas le motif "Inventaire annuel"

  @alternatif @securite @RG-03-04-06
  Scénario: La description est restituée comme du texte
    Étant donné la description de "Express Douala" est "<img src=x onerror=alert(1)> Livraison 7j/7"
    Quand un visiteur consulte la fiche "express-douala"
    Alors la description est restituée exactement comme ce texte
    Et aucun balisage n'est interprété à l'affichage
