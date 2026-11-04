# language: fr
@UC-02-06 @B2.6
Fonctionnalité: Modifier le profil de l'agence
  Afin que la présentation de mon agence reste exacte
  En tant que propriétaire ou administrateur d'agence
  Je veux modifier son nom commercial et sa description

  Contexte:
    Étant donné l'agence "Express Douala" au statut brouillon
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"

  @nominal @RG-02-06-01
  Scénario: Un administrateur ajoute une description
    Quand "Paul Mbarga" enregistre la description "Livraison express dans Douala, 7j/7"
    Alors la description de "Express Douala" est "Livraison express dans Douala, 7j/7"
    Et le nom commercial reste "Express Douala"

  @nominal @RG-02-06-01
  Scénario: La propriétaire change le nom commercial
    Quand "Awa Ngono" enregistre le nom commercial "Express Douala & Littoral"
    Alors le nom commercial de l'agence est "Express Douala & Littoral"

  @alternatif @RG-02-06-02
  Scénario: Le profil d'une agence soumise reste modifiable
    Étant donné "Express Douala" soumise à vérification
    Quand "Paul Mbarga" enregistre la description "Livraison et stockage à Douala"
    Alors la description de l'agence est "Livraison et stockage à Douala"
    Et l'agence reste au statut soumise

  @alternatif @RG-02-06-03
  Scénario: La description peut être vidée
    Étant donné la description de "Express Douala" est "Livraison express"
    Quand "Paul Mbarga" vide la description
    Alors "Express Douala" n'a plus de description

  @erreur @RG-02-06-01
  Plan du scénario: Bornes de longueur de la description
    Quand "Paul Mbarga" enregistre une description de <longueur> caractères
    Alors l'enregistrement est <résultat>

    Exemples:
      | longueur | résultat |
      | 1000     | accepté  |
      | 1001     | refusé   |

  @erreur @RG-02-06-03
  Scénario: Le nom commercial ne peut pas être vidé
    Quand "Awa Ngono" enregistre un nom commercial vide
    Alors l'enregistrement est refusé
    Et le nom commercial reste "Express Douala"

  @erreur @concurrence @RG-02-06-04 @EX-02-012
  Scénario: Une modification du profil fondée sur une version périmée est refusée
    Étant donné "Express Douala" est en version 6
    Quand "Paul Mbarga" enregistre la description "Ancienne présentation" sur la version 5
    Alors l'enregistrement est refusé pour conflit
    Et la description de "Express Douala" est inchangée

  @erreur @securite @RG-02-06-05 @EX-02-002
  Scénario: Une agente ne peut pas modifier le profil
    Quand "Céline Fotso" enregistre la description "Meilleure agence de Douala"
    Alors l'action lui est refusée comme non autorisée
    Et la description de "Express Douala" est inchangée

  @erreur @securite @RG-02-06-05 @EX-02-001
  Plan du scénario: Une personne sans accès actif ne trouve pas l'agence
    Étant donné <situation>
    Quand "<personne>" enregistre la description "Autre présentation" pour "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable

    Exemples:
      | personne      | situation                                                    |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement  |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"        |

  @erreur @securite @RG-02-06-05 @EX-02-003
  Scénario: Une donnée d'identité ne peut pas être modifiée par le profil
    Étant donné "Express Douala" soumise à vérification
    Quand "Paul Mbarga" enregistre par le profil la raison sociale "Autre SARL"
    Alors l'enregistrement est refusé
    Et la raison sociale de "Express Douala" est inchangée

  @nominal @RG-02-06-06 @EX-02-005
  Scénario: La modification du profil est tracée dans le journal d'audit
    Quand "Paul Mbarga" enregistre la description "Livraison express dans Douala"
    Alors le journal d'audit contient « profil modifié : description » par "Paul Mbarga"
