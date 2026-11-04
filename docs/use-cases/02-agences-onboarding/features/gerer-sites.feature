# language: fr
@UC-02-08 @B2.8
Fonctionnalité: Gérer les sites de l'agence
  Afin que la plateforme connaisse mes points physiques
  En tant que propriétaire ou administrateur d'agence
  Je veux créer, modifier, désactiver et réactiver les sites de mon agence

  Contexte:
    Étant donné l'agence "Express Douala" au statut brouillon
    Et "Awa Ngono" propriétaire active de "Express Douala"
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"

  @nominal @RG-02-08-01
  Scénario: Un administrateur crée un site
    Quand "Paul Mbarga" crée le site "Agence Akwa" à "Douala", adresse "Rue Joss, face Total Akwa"
    Alors "Express Douala" possède le site actif "Agence Akwa" à "Douala"

  @nominal @RG-02-08-03
  Scénario: La propriétaire modifie l'adresse d'un site
    Étant donné "Express Douala" possède le site actif "Agence Akwa"
    Quand "Awa Ngono" change l'adresse de "Agence Akwa" en "Boulevard de la Liberté, Akwa"
    Alors l'adresse du site "Agence Akwa" est "Boulevard de la Liberté, Akwa"
    Et le nom du site reste "Agence Akwa"

  @alternatif @RG-02-08-04 @EX-02-007
  Scénario: Un site désactivé est conservé
    Étant donné "Express Douala" possède les sites actifs "Agence Akwa" et "Comptoir Deïdo"
    Quand "Paul Mbarga" désactive le site "Comptoir Deïdo" le "2026-11-12"
    Alors le site "Comptoir Deïdo" apparaît comme désactivé depuis le "2026-11-12"
    Et le site "Agence Akwa" reste actif

  @alternatif @RG-02-08-04
  Scénario: Un site désactivé peut être réactivé
    Étant donné le site "Comptoir Deïdo" de "Express Douala" désactivé
    Quand "Paul Mbarga" réactive le site "Comptoir Deïdo"
    Alors le site "Comptoir Deïdo" est de nouveau actif

  @alternatif @RG-02-08-07 @RG-02-08-08
  Scénario: Une agente consulte la liste des sites
    Étant donné "Express Douala" possède le site actif "Agence Akwa" et le site désactivé "Comptoir Deïdo"
    Quand "Céline Fotso" consulte les sites de "Express Douala"
    Alors elle voit "Agence Akwa" comme actif puis "Comptoir Deïdo" comme désactivé

  @erreur @RG-02-08-02
  Plan du scénario: Deux sites actifs ne portent pas le même nom
    Étant donné "Express Douala" possède le site actif "Agence Akwa"
    Quand "Paul Mbarga" crée le site "<nom>" à "Douala", adresse "Rue Gallieni"
    Alors la création est refusée pour doublon
    Et "Express Douala" ne compte qu'un seul site "Agence Akwa"

    Exemples:
      | nom          |
      | Agence Akwa  |
      | agence AKWA  |
      | Agence Akwá  |

  @erreur @RG-02-08-01
  Plan du scénario: Bornes de longueur du nom de site
    Quand "Paul Mbarga" crée un site dont le nom compte <longueur> caractères utiles
    Alors la création est <résultat>

    Exemples:
      | longueur | résultat |
      | 1        | refusée  |
      | 2        | acceptée |
      | 120      | acceptée |
      | 121      | refusée  |

  @erreur @RG-02-08-05 @RM-02-02
  Scénario: Le dernier site actif ne peut pas être désactivé tant que le stockage est actif
    Étant donné "Express Douala" possède le seul site actif "Dépôt Bonabéri"
    Et la capacité stockage de "Express Douala" est active
    Quand "Paul Mbarga" désactive le site "Dépôt Bonabéri"
    Alors la désactivation est refusée pour conflit
    Et le site "Dépôt Bonabéri" reste actif

  @erreur @RG-02-08-04
  Scénario: Un site ne peut pas être réactivé si son nom est déjà pris
    Étant donné le site "Comptoir Deïdo" de "Express Douala" désactivé
    Et un autre site actif "Comptoir Deïdo" créé ensuite
    Quand "Paul Mbarga" réactive l'ancien site "Comptoir Deïdo"
    Alors la réactivation est refusée pour conflit

  @erreur @concurrence @RG-02-08-06 @EX-02-012
  Scénario: Une modification de site fondée sur une version périmée est refusée
    Étant donné le site "Agence Akwa" en version 2
    Quand "Awa Ngono" change l'adresse de "Agence Akwa" sur la version 1
    Alors la modification est refusée pour conflit
    Et l'adresse du site "Agence Akwa" est inchangée

  @concurrence @RG-02-08-02 @EX-02-004
  Scénario: Deux créations simultanées du même site n'en créent qu'un
    Quand "Awa Ngono" et "Paul Mbarga" créent en même temps le site "Agence Bonapriso"
    Alors "Express Douala" ne compte qu'un seul site actif "Agence Bonapriso"
    Et l'une des deux créations est refusée pour doublon

  @erreur @securite @RG-02-08-07 @EX-02-002
  Scénario: Une agente ne peut pas créer de site
    Quand "Céline Fotso" crée le site "Comptoir Bali" à "Douala", adresse "Rue de Bali"
    Alors l'action lui est refusée comme non autorisée
    Et "Express Douala" ne possède pas de site "Comptoir Bali"

  @erreur @securite @RG-02-08-07 @EX-02-001
  Plan du scénario: Une personne sans accès actif ne trouve pas les sites de l'agence
    Étant donné <situation>
    Quand "<personne>" consulte les sites de "Express Douala"
    Alors l'agence "Express Douala" lui est introuvable
    Et aucun site de "Express Douala" ne lui est renvoyé

    Exemples:
      | personne      | situation                                                    |
      | Ibrahim Bello | "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement  |
      | Jean Etoa     | "Jean Etoa" ancien administrateur de "Express Douala"        |

  @erreur @securite @RG-02-08-07 @EX-02-001
  Scénario: Un site d'une autre agence est introuvable
    Étant donné l'agence "Rapide Yaoundé" possède le site actif "Agence Bastos"
    Quand "Awa Ngono" désactive, au nom de "Express Douala", le site "Agence Bastos" de "Rapide Yaoundé"
    Alors le site lui est introuvable
    Et le site "Agence Bastos" de "Rapide Yaoundé" reste actif

  @nominal @RG-02-08-09 @EX-02-005
  Scénario: La création d'un site est tracée dans le journal d'audit
    Quand "Paul Mbarga" crée le site "Agence Akwa" à "Douala", adresse "Rue Joss"
    Alors le journal d'audit contient « site créé : Agence Akwa » par "Paul Mbarga"
