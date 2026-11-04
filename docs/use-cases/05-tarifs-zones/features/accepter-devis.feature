# language: fr
@UC-05-08 @B3.8
Fonctionnalité: Accepter un devis
  Afin que le prix convenu avec un client ne puisse plus changer
  En tant que membre d'agence
  Je veux enregistrer l'acceptation d'un devis

  Contexte:
    Étant donné l'agence "Express Douala" soumise à vérification avec la livraison active
    Et "Paul Mbarga" administrateur actif de "Express Douala"
    Et "Céline Fotso" agente active de "Express Douala"
    Et le devis "DEV-2026-000001" émis le 2026-11-10 à 09:00 par "Express Douala" pour "Jean Kamga", total 2500 FCFA selon la version 1, vers "Douala / Akwa"

  @nominal @RG-05-08-01 @RM-05-01
  Scénario: Une agente enregistre l'acceptation d'un devis
    Étant donné nous sommes le 2026-11-12 à 10:00
    Quand "Céline Fotso" enregistre l'acceptation du devis "DEV-2026-000001"
    Alors le devis "DEV-2026-000001" est accepté à 2500 FCFA
    Et l'acceptation est datée du 2026-11-12 à 10:00 et attribuée à "Céline Fotso"

  @alternatif @RG-05-08-01 @RM-05-01
  Scénario: Le prix d'un devis accepté ne suit pas une nouvelle version
    Étant donné le devis "DEV-2026-000001" accepté
    Quand "Paul Mbarga" publie la version 2 où "Douala / Akwa" jusqu'à 1 kg coûte 1200 FCFA
    Alors le devis "DEV-2026-000001" reste accepté à 2500 FCFA selon la version 1

  @alternatif @RG-05-08-05 @EX-05-011
  Scénario: Accepter un devis ne crée pas de commande
    Quand "Céline Fotso" enregistre l'acceptation du devis "DEV-2026-000001"
    Alors aucune commande n'existe pour ce devis
    Et aucun message n'est envoyé à "Jean Kamga"

  @erreur @RG-05-08-02
  Scénario: Un devis déjà accepté ne s'accepte pas une seconde fois
    Étant donné "Céline Fotso" a enregistré l'acceptation du devis "DEV-2026-000001"
    Quand "Paul Mbarga" enregistre l'acceptation du devis "DEV-2026-000001"
    Alors l'acceptation est refusée car le devis est déjà accepté
    Et l'acceptation reste attribuée à "Céline Fotso"

  @concurrence @RG-05-08-02 @EX-05-004
  Scénario: Deux acceptations simultanées n'en retiennent qu'une
    Quand "Céline Fotso" et "Paul Mbarga" enregistrent en même temps l'acceptation du devis "DEV-2026-000001"
    Alors le devis est accepté une seule fois
    Et le journal d'audit contient une seule trace « devis accepté »

  @erreur @RG-05-08-03
  Plan du scénario: Un devis s'accepte jusqu'à sa date de validité incluse
    Étant donné nous sommes le <moment>
    Quand "Céline Fotso" enregistre l'acceptation du devis "DEV-2026-000001"
    Alors l'acceptation est <résultat>

    Exemples:
      | moment               | résultat                     |
      | 2026-11-17 à 09:00   | enregistrée                  |
      | 2026-11-17 à 09:01   | refusée car le devis a expiré |

  @erreur @RG-05-08-04
  Scénario: Un devis ne s'accepte pas quand la livraison est suspendue
    Étant donné la capacité livraison de "Express Douala" a été suspendue après l'émission
    Quand "Céline Fotso" enregistre l'acceptation du devis "DEV-2026-000001"
    Alors l'acceptation est refusée car la livraison n'est pas active
    Et le devis reste non accepté

  @erreur @securite @RG-05-08-07 @EX-05-001
  Scénario: Le devis d'une autre agence est introuvable
    Étant donné "Ibrahim Bello" propriétaire de "Rapide Yaoundé" uniquement
    Quand "Ibrahim Bello" enregistre l'acceptation du devis "DEV-2026-000001" de "Express Douala"
    Alors le devis lui est introuvable
    Et le devis reste non accepté

  @erreur @securite @RG-05-08-07 @EX-05-001
  Scénario: Un ancien membre ne trouve plus le devis
    Étant donné "Jean Etoa" ancien administrateur de "Express Douala"
    Quand "Jean Etoa" enregistre l'acceptation du devis "DEV-2026-000001"
    Alors le devis lui est introuvable

  @erreur @RG-05-08-07
  Scénario: Un devis inconnu est introuvable
    Quand "Céline Fotso" enregistre l'acceptation du devis "DEV-2026-999999"
    Alors le devis lui est introuvable

  @nominal @RG-05-08-08 @EX-05-005
  Scénario: L'acceptation est tracée
    Quand "Céline Fotso" enregistre l'acceptation du devis "DEV-2026-000001"
    Alors le journal d'audit contient « devis accepté » par "Céline Fotso" pour ce devis
    Et la trace ne contient ni le nom ni le téléphone du destinataire
