# UC-05-08 — Accepter un devis

| Champ | Valeur |
|---|---|
| Statut | Brouillon (en attente de Q-32, Q-33, Q-34) |
| Priorité | Must |
| Domaine | `pricing` |
| Tâche | B3.8 |
| Date | 2026-11-04 |
| Use cases liés | UC-05-07 (émission) ; UC-05-03 (zone retirée) ; UC-05-05 (versions) ; UC-03-07 (B4, acceptation d'une demande) ; UC-06-02 (B5, commande issue d'un devis ou d'une demande) |
| Exigences couvertes | UC-05-08, RM-05-01, RM-05-02, EX-05-001, 003 à 007, 009, 011 |

## 0. Traçabilité

| Exigence | Source | Où elle est traitée |
|---|---|---|
| UC-05-08 | F05 §8 ; PH B3.8 (« prix figé à l'acceptation ») | §8 ; scénario 1 |
| RM-05-01 | F05 §Règles ; consigne B3 | RG-05-08-01 ; scénarios 1, 2 |
| RM-05-02 | F05 §Règles | RG-05-08-04 ; UC-05-03 scénario 3 |
| EX-05-004 | F05 §8 | RG-05-08-02 ; scénarios 4, 5 |
| EX-05-009 | CL | RG-05-08-06 |
| EX-05-011 | CL Hors périmètre | RG-05-08-05 ; scénario 3 |
| EX-05-005 | F05 §8 | scénario 11 |
| EX-05-001, 003, 006, 007 | ARC3 ; ARC5 | scénarios 8, 9, 10 ; tests 9, 10 |

## 1. Objectif

Enregistrer l'accord du client sur un devis, ce qui fige définitivement le prix convenu, sans encore créer de commande.

## 2. User story

> En tant que **membre d'agence**, je veux **enregistrer qu'un client a accepté son devis**, afin que **le prix convenu ne puisse plus changer**.

## 3. Acteurs

Principal : tout membre actif, au nom du client qui a donné son accord hors plateforme **[HYPOTHÈSE]** (Q-32, anomalie A-24). L'acceptation par le client lui-même, depuis son compte, relève de B4 (demande marketplace).

## 4. Déclencheur

Le client donne son accord (au comptoir, par téléphone) pendant la validité du devis.

## 5. Préconditions

- P1 : session valide ; P2 : membre actif.
- P3 : devis de l'agence, émis, non accepté, non expiré.
- P4 : zone du devis toujours active ; livraison active **[HYPOTHÈSE]**.

## 6. Postconditions

- Succès : devis « accepté », avec date et auteur de l'acceptation ; prix figé définitivement ; trace « devis accepté » ; **aucune commande créée**.
- Échec : devis inchangé, aucune trace.

## 7. Règles métier

| ID | Règle | Exemple | Source |
|---|---|---|---|
| RG-05-08-01 | **RM-05-01** L'acceptation fige définitivement le prix retenu, le numéro de version et le libellé de zone du devis ; aucune nouvelle version, correction ou retrait de zone ne les change ensuite. | DEV-2026-000001 accepté à 2 500 (v1) ; v2 publiée → toujours 2 500 (v1). | RM-05-01 |
| RG-05-08-02 | Un devis ne s'accepte qu'**une fois** : une seconde acceptation est refusée pour conflit, sans second effet ni seconde trace ; deux acceptations simultanées → une seule réussit. | Paul accepte après Céline → refus, auteur reste Céline. | D-14 (analogie) ; EX-05-004 |
| RG-05-08-03 | **[HYPOTHÈSE]** (Q-30) Un devis s'accepte jusqu'à sa date de validité incluse ; après, il est expiré et l'acceptation est refusée. | Émis 2026-11-10 09:00 : accepté le 2026-11-17 à 09:00 ; refusé à 09:01. | RG-05-07-05 |
| RG-05-08-04 | Zone retirée depuis l'émission → refus (UC-05-03) ; livraison suspendue → refus **[HYPOTHÈSE]** (Q-33). | Livraison suspendue le 11/11 → acceptation refusée le 12/11. | RM-05-02 ; RM-02-03 |
| RG-05-08-05 | Accepter un devis ne crée **aucune commande** et n'envoie rien au client ; la commande issue d'un devis accepté relève du lot 5 **[HYPOTHÈSE]** (Q-34). | Après acceptation, « Express Douala » n'a aucune nouvelle commande. | RM-03-02 (analogie) ; ACC ; CL |
| RG-05-08-06 | Un devis accepté est définitif : ni modification, ni annulation en B3. | — | EX-05-009 |
| RG-05-08-07 | Tout membre actif accepte un devis de son agence ; ancien membre, autre agence, devis inconnu ou d'une autre agence → introuvable. | Ibrahim accepte DEV-2026-000001 d'Express Douala → introuvable. | EX-05-001 |
| RG-05-08-08 | L'acceptation est auditée (« devis accepté », identifiant) et émet l'événement `QuoteAccepted` (audit seulement, aucun canal externe). | — | EX-05-005 ; ARC6 |

## 8. Flux nominal

1. Le membre désigne le devis et enregistre l'acceptation (action sans contenu).
2. Le système vérifie session et membership actif.
3. Le système charge le devis sous verrou, dans l'agence du chemin (introuvable sinon).
4. Le système vérifie qu'il est émis, non accepté, non expiré (RG-05-08-02, 03).
5. Le système vérifie la zone et la capacité livraison (RG-05-08-04).
6. Le système enregistre l'acceptation (date, auteur) ; le prix devient définitif.
7. Le système écrit la trace et renvoie le devis accepté.

## 9. Flux alternatifs

Aucun : l'acceptation est une action unique ; la consultation est décrite dans UC-05-07 A3.

## 10. Flux d'exception

- E1 — Session invalide : 401. E2 — Non membre, ancien membre, autre agence, devis inconnu ou d'autrui : 404.
- E3 — Déjà accepté : 409 `QUOTE_ALREADY_ACCEPTED`. E4 — Expiré : 409 `QUOTE_EXPIRED`.
- E5 — Zone retirée : 409 `ZONE_RETIRED`. E6 — Livraison non active : 409 `DELIVERY_NOT_ACTIVE`.
- E7 — Contenu non vide : 400.

## 11. Workflow

```mermaid
sequenceDiagram
    actor M as Membre d'agence
    participant P as Tarification
    participant A as Agences (zones, capacités)
    M->>P: accepter le devis (agence du chemin)
    P->>P: membership actif ? devis de l'agence ? (sinon introuvable)
    P->>P: verrou du devis ; émis, non accepté, non expiré ?
    P->>A: zone active ? livraison active ?
    A-->>P: oui
    P->>P: accepté (date, auteur) ; prix figé ; audit
    P-->>M: devis accepté
    Note over P: aucune commande, aucune notification
```

## 12. Scénarios d'acceptation (Gherkin)

Copie conforme de [features/accepter-devis.feature](features/accepter-devis.feature).

```gherkin
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
```

## 13. Plan de tests TDD

| # | Niveau | Comportement | Étant donné | Quand | Alors | Règle |
|---|---|---|---|---|---|---|
| 1 | unit (domaine `Quote`) | Accepter | devis émis | accepter le 12/11 | statut accepté, date, auteur ; événement `QuoteAccepted` | RG-05-08-01, 08 |
| 2 | unit (domaine) | Déjà accepté | devis accepté | accepter | `conflict` `QUOTE_ALREADY_ACCEPTED`, aucun événement | RG-05-08-02 |
| 3 | unit (domaine) | Bornes de validité | émis 10/11 09:00 | 17/11 09:00 ; 09:01 | accepté ; `conflict` `QUOTE_EXPIRED` | RG-05-08-03 |
| 4 | unit (domaine) | Immuabilité | devis accepté | toute tentative de modification | aucune méthode ne le permet ; prix inchangé après v2 | RG-05-08-01, 06 |
| 5 | unit (application) | Zone et capacité | fakes | zone retirée ; livraison suspendue | `conflict` ×2 ; devis inchangé | RG-05-08-04 |
| 6 | unit (application) | Aucune commande | fakes | accepter | aucun appel hors `pricing` ; seul l'audit réagit à l'événement | RG-05-08-05 |
| 7 | unit (application) | Droits et isolation | fakes | agent ; non-membre ; ancien membre ; devis d'autrui ; inconnu | OK ; `not_found` ×4 | RG-05-08-07 |
| 8 | feature (PostgreSQL) | Concurrence | devis émis | 2 acceptations simultanées | une seule réussit ; une seule trace (verrou du devis + `UPDATE … WHERE status = 'issued'`) | RG-05-08-02 |
| 9 | E2E | 200, 400, 401 | — | accepter ; corps non vide ; sans jeton | codes attendus | RG-05-08-01 |
| 10 | E2E | 404, 409 | — | autre agence ; ancien membre ; inconnu ; déjà accepté ; expiré (horloge de test) ; zone retirée ; livraison suspendue | 404 ×3 ; 409 ×4 | RG-05-08-02 à 04, 07 |

## 14. Données

Aucune entrée (action sans contenu). Sortie : le devis (UC-05-07) avec `acceptedAt` et `acceptedBy`.

## 15. Exigences non fonctionnelles

- Acceptation unique garantie en base (mise à jour conditionnée au statut, test 8).
- Pas de clé d'idempotence obligatoire : un second envoi reçoit 409 sans effet (comme D-14) ; à revoir si l'acceptation est un jour exposée au client mobile (réseau intermittent).

## 16. Hors périmètre

Création de la commande (B5, Q-34) ; acceptation par le client depuis son compte (B4) ; refus, annulation ou renégociation d'un devis ; paiement, acompte, facture ; notification du client.

## 17. Questions ouvertes

| # | Question | Hypothèse retenue | Impact si différent |
|---|---|---|---|
| Q-32 | Qui enregistre l'acceptation ? | Tout membre actif, au nom du client. | Rôle restreint ; ou acceptation par le client seulement (B4). |
| Q-33 | Refuser l'acceptation si la zone est retirée ou la livraison suspendue ? | Oui. | L'agence honore des devis sur un service arrêté. |
| Q-34 | Un devis accepté devient-il une commande ? | En B5, par une action distincte ; jamais automatiquement en B3. | Orchestration devis → commande à spécifier. |

## 18. Notes pour le tech lead

- Action dédiée (`POST …/quotes/{quoteId}/accept`), jamais un `PATCH { status }`.
- Le devis est cherché dans l'agence du chemin seulement ; l'identifiant d'un devis d'une autre agence donne la même réponse qu'un identifiant inconnu.

Definition of Ready :
- [x] Chaque exigence de la section 0 a au moins un scénario
- [x] Chaque règle a un exemple
- [x] Chaque flux d'exception a un scénario (E1, E7 : test 9 ; E5 : UC-05-03)
- [ ] Aucune question bloquante (Q-32, Q-34)
- [x] Le plan TDD couvre chaque règle
- [x] Le `.feature` est synchronisé avec la section 12
