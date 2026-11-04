# language: fr
@UC-03-01 @B3.9
Fonctionnalité: Publier la fiche publique de l'agence
  Afin d'être trouvé par des clients sans exposer mes données internes
  En tant que propriétaire d'agence
  Je veux publier la fiche de mon agence soumise

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification, non approuvée
    Et "Express Douala" a la livraison active, les zones "Douala / Akwa" et "Douala / Bonabéri" et le site "Agence Akwa" à "Douala"
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"
    Et la fiche de "Express Douala" n'est pas publiée

  @nominal @RG-03-01-01 @RG-03-01-02 @RG-03-01-07 @D-05
  Scénario: La propriétaire publie la fiche d'une agence soumise
    Quand "Awa Ngono" publie la fiche de "Express Douala"
    Alors la fiche publique "express-douala" est visible par un visiteur non connecté
    Et elle porte la mention « non vérifiée »

  @nominal @securite @RG-03-01-03 @RM-03-01
  Scénario: La fiche ne contient que les informations autorisées
    Étant donné l'identité de "Express Douala" : téléphone "+237677123456", RCCM "RC/DLA/2024/B/1234", NIU "M012345678901A", adresse du siège "Rue Joss, face pharmacie"
    Quand "Awa Ngono" publie la fiche de "Express Douala"
    Alors la fiche publique "express-douala" contient le nom, la description, la mention de vérification, la livraison, les zones, la ville "Douala" et les tarifs indicatifs
    Et elle ne contient ni téléphone, ni e-mail, ni RCCM, ni NIU, ni adresse, ni membre, ni client

  @alternatif @RG-03-01-07
  Scénario: Deux agences de même nom reçoivent des adresses publiques distinctes
    Étant donné une autre agence soumise nommée "Express Douala" dont la fiche "express-douala" est déjà publiée
    Quand "Awa Ngono" publie la fiche de son agence "Express Douala"
    Alors la fiche de son agence est publiée à l'adresse "express-douala-2"

  @alternatif @RG-03-01-07 @RG-03-01-11
  Scénario: Changer de nom ne change pas l'adresse publique
    Étant donné la fiche "express-douala" publiée
    Quand "Paul Mbarga" renomme l'agence "Express Douala & Littoral"
    Alors la fiche publique "express-douala" affiche le nom "Express Douala & Littoral"

  @alternatif @RG-03-01-08
  Scénario: Retirer puis republier conserve l'adresse publique
    Étant donné la fiche "express-douala" publiée
    Et "Awa Ngono" a retiré la fiche de "Express Douala"
    Quand "Awa Ngono" publie de nouveau la fiche de "Express Douala"
    Alors la fiche publique "express-douala" est de nouveau visible

  @erreur @RG-03-01-01 @D-05
  Scénario: Une agence en brouillon ne peut pas être publiée
    Étant donné l'agence "Colis Bafoussam" au statut brouillon dont "Awa Ngono" est propriétaire
    Quand "Awa Ngono" publie la fiche de "Colis Bafoussam"
    Alors la publication est refusée car l'agence n'est pas soumise

  @erreur @securite @RG-03-01-05
  Scénario: Une agence au nom provisoire ne peut pas être publiée
    Étant donné "Express Douala" porte encore le nom provisoire « Agence » suivi des 8 premiers caractères de son identifiant
    Quand "Awa Ngono" publie la fiche de "Express Douala"
    Alors la publication est refusée car le nom est provisoire

  @erreur @securite @RG-03-01-04
  Plan du scénario: Un nom contenant un caractère de format invisible n'est pas publiable
    Étant donné le nom commercial de "Express Douala" contient le caractère <caractère>
    Quand "Awa Ngono" publie la fiche de "Express Douala"
    Alors la publication est refusée car le nom n'est pas publiable

    Exemples:
      | caractère                          |
      | U+202E (inversion droite-gauche)   |
      | U+200B (espace de largeur nulle)   |
      | U+FEFF (indicateur d'ordre)        |

  @erreur @RG-03-01-06
  Scénario: Une agence sans capacité active ne peut pas être publiée
    Étant donné la seule capacité de "Express Douala", la livraison, est suspendue
    Quand "Awa Ngono" publie la fiche de "Express Douala"
    Alors la publication est refusée car aucune capacité n'est active

  @alternatif @RG-03-01-06
  Scénario: Une fiche publiée sans capacité active est masquée
    Étant donné la fiche "express-douala" publiée
    Quand "Paul Mbarga" suspend la livraison, seule capacité active de "Express Douala"
    Alors la fiche publique "express-douala" est introuvable
    Et la fiche de "Express Douala" reste publiée

  @erreur @RG-03-01-09
  Scénario: Une fiche déjà publiée ne se publie pas une seconde fois
    Étant donné la fiche "express-douala" publiée par "Awa Ngono" le 2026-11-12
    Quand "Awa Ngono" publie la fiche de "Express Douala"
    Alors la publication est refusée car la fiche est déjà publiée
    Et la date de publication reste le 2026-11-12

  @concurrence @RG-03-01-09
  Scénario: Deux publications simultanées n'en retiennent qu'une
    Quand "Awa Ngono" publie deux fois en même temps la fiche de "Express Douala"
    Alors la fiche est publiée une seule fois
    Et le journal d'audit contient une seule trace « fiche publiée »

  @concurrence @RG-03-01-07
  Scénario: Deux agences homonymes publiées en même temps reçoivent des adresses distinctes
    Étant donné une autre agence soumise nommée "Express Douala" dont "Ibrahim Bello" est propriétaire
    Quand "Awa Ngono" et "Ibrahim Bello" publient en même temps la fiche de leur agence
    Alors les deux fiches sont publiées aux adresses "express-douala" et "express-douala-2"

  @erreur @securite @RG-03-01-10 @D-05
  Plan du scénario: Seule la propriétaire publie la fiche
    Quand "<personne>" publie la fiche de "Express Douala"
    Alors l'action lui est refusée comme non autorisée
    Et la fiche de "Express Douala" n'est pas publiée

    Exemples:
      | personne     |
      | Paul Mbarga  |
      | Céline Fotso |

  @erreur @securite @RG-03-01-10
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" publie la fiche de "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable

    Exemples:
      | personne      | situation                                                   |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"       |

  @alternatif @securite @RG-03-01-13
  Scénario: Une description contenant du balisage est publiée comme du texte
    Étant donné la description de "Express Douala" est "<script>alert(1)</script> Livraison 7j/7"
    Quand "Awa Ngono" publie la fiche de "Express Douala"
    Alors la fiche publique restitue la description exactement comme ce texte
    Et aucun balisage n'est interprété à l'affichage

  @nominal @RG-03-01-12
  Scénario: La publication est tracée
    Quand "Awa Ngono" publie la fiche de "Express Douala"
    Alors le journal d'audit contient « fiche publiée » par "Awa Ngono" pour "Express Douala"

