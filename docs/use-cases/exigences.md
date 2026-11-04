# Exigences — inventaire, anomalies et traçabilité

Spécification exécutable issue du cahier des charges (`docs/cahier-des-charges/`, lecture seule). Chaque exigence garde l'identifiant de la source quand il existe (`UC-02-0x`, `RM-02-0x`) ; les exigences transverses reçoivent un identifiant `EX-02-NNN`.

| Lot | Phase | Fiche | Date | Rédacteur |
|---|---|---|---|---|
| 2 — Onboarding agence | B2 (S1) | `docs/modules/02-agences-onboarding.md` | 2026-11-03 | `use-case-writer` |
| 3 — Tarifs, zones, marketplace publique | B3 (S1) — voir [§B3](#b3--tarifs-zones-et-marketplace-publique) | `docs/modules/05-tarifs-zones.md`, `docs/modules/03-marketplace.md` (UC-03-01 à 04) | 2026-11-04 | `use-case-writer` |

Sources lues intégralement : `README.md`, `CODEX.md`, `docs/architecture/01` à `06`, `docs/delivery/roadmap.md`, `docs/delivery/acceptance.md`, `docs/modules/02-agences-onboarding.md` ; pour le contexte : fiches 01, 03, 05, 15 ; `backend/docs/domains.md`, `events.md`, `routes/identite-acces.md`, `routes/groupes-prevus.md`.

Abréviations de source : **F02** = `docs/modules/02-agences-onboarding.md` ; **ARC1…ARC6** = `docs/architecture/0N-*.md` ; **RDM** = `docs/delivery/roadmap.md` ; **ACC** = `docs/delivery/acceptance.md` ; **CDX** = `CODEX.md` ; **DOM** = `backend/docs/domains.md` ; **RIA** = `backend/docs/routes/identite-acces.md` ; **PH** = `phases.md` §B2 ; **CL** = `CLAUDE.md`.

---

## 1. Inventaire

### 1.1 Cas d'usage de la fiche (fonctionnels)

| ID | Source | Énoncé reformulé (vérifiable) | Type | Priorité | Use case(s) |
|---|---|---|---|---|---|
| UC-02-01 | F02 §Cas d'usage 1 ; PH B2.1 | Une personne connectée crée une agence qui naît au statut brouillon, et elle en devient propriétaire active dans la même opération. | Fonctionnel | Must | UC-02-01 |
| UC-02-02 | F02 §2 ; PH B2.2 | Un responsable de l'agence complète l'identité de l'agence (raison sociale, siège, contacts) tant que l'agence est en brouillon. | Fonctionnel | Must | UC-02-02 |
| UC-02-03 | F02 §3 ; PH B2.3 | Un responsable déclare et retire les zones desservies par l'agence (ville, quartier facultatif). | Fonctionnel | Must | UC-02-03 |
| UC-02-04 | F02 §4 ; PH B2.4 ; ARC1 ADR-04 | Un responsable active la capacité livraison, la capacité stockage, ou les deux (agence hybride), chacune séparément, si sa configuration minimale est remplie. | Fonctionnel | Must | UC-02-04 |
| UC-02-05 | F02 §5 ; PH B2.5 ; RDM lot 2 | Le propriétaire soumet l'agence à vérification : le statut passe de brouillon à soumise par une action dédiée, une seule fois. | Fonctionnel | Must | UC-02-05 |
| UC-02-06 | F02 §6 ; PH B2.6 | Un responsable modifie le profil descriptif de l'agence (nom commercial, description), y compris après soumission. | Fonctionnel | Should | UC-02-06 |
| UC-02-07 | F02 §7 ; PH B2.7 | Un responsable suspend une capacité active ; l'agence conserve son historique et la capacité n'accepte plus de nouvelles demandes. | Fonctionnel | Must | UC-02-07 |
| UC-02-08 | F02 §8 ; PH B2.8 | Un responsable crée, modifie, désactive et réactive les sites (points physiques) de l'agence, et les consulte. | Fonctionnel | Must | UC-02-08 |
| UC-02-09 | F02 §API (`GET /agencies/{id}/onboarding`) ; PH B2.9 — **ajouté, absent de la liste numérotée de la fiche** (anomalie A-01) | Tout membre actif consulte l'état d'onboarding : statut, éléments remplis et manquants pour la soumission, capacités, nombre de zones et de sites. | Fonctionnel | Must | UC-02-09 |

### 1.2 Règles métier de la fiche

| ID | Source | Énoncé source | Reformulation vérifiable | Type | Priorité | Use case(s) |
|---|---|---|---|---|---|---|
| RM-02-01 | F02 §Règles | « Une agence non approuvée peut être brouillon. » | Une agence est créée au statut brouillon sans approbation préalable et y reste jusqu'à une soumission explicite ; toutes les opérations de configuration (identité, profil, zones, capacités, sites) sont possibles en brouillon. | Règle | Must | UC-02-01, UC-02-02, UC-02-05, UC-02-09 |
| RM-02-02 | F02 §Règles | « capacité doit avoir configuration minimale. » | L'activation d'une capacité est refusée tant que sa configuration minimale n'est pas remplie ; contenu de la configuration minimale **[HYPOTHÈSE] (D-04)** : livraison = au moins une zone desservie active ; stockage = au moins un site actif. | Règle | Must | UC-02-04, UC-02-03, UC-02-08, UC-02-05 |
| RM-02-03 | F02 §Règles | « suspension bloque nouvelles demandes sans effacer historique. » | Une capacité suspendue reste enregistrée avec son historique (activation, suspension, motif, auteur, date) ; elle n'est plus comptée comme active ; le refus des nouvelles demandes sur cette capacité est vérifié au lot 4 (UC-03-05). | Règle | Must | UC-02-07, UC-02-09 |
| RM-02-04 | F02 §Règles | « vérification ne signifie pas assurance. » | La soumission ou la vérification n'attribue à l'agence aucun attribut « assurée » ou « garantie » ; l'état d'onboarding ne présente jamais la soumission comme une garantie. | Règle | Should | UC-02-05, UC-02-09 |

### 1.3 Exigences transverses applicables au lot

| ID | Source | Énoncé reformulé (vérifiable) | Type | Priorité | Use case(s) |
|---|---|---|---|---|---|
| EX-02-001 | ARC3 §Sécurité ; CL Fiche projet ; DOM §Agences | Une personne qui n'est pas membre **actif** de l'agence (autre agence, ancien membre désactivé) obtient « agence introuvable » (404), jamais « interdit », et aucune donnée de l'agence. | Sécurité | Must | tous |
| EX-02-002 | RIA §Accès agence ; RM-01-03 | Un membre actif dont le rôle ne permet pas l'action obtient « action non autorisée » (403) ; la matrice des rôles est une **[HYPOTHÈSE]** (README §Matrice des droits). | Sécurité | Must | UC-02-02 à UC-02-08 |
| EX-02-003 | CDX §Contraintes ; CL Fiche projet | L'agence visée est désignée par le chemin et validée côté serveur par le membership ; aucun identifiant d'agence, statut ou rôle n'est accepté dans le contenu d'une demande. | Sécurité | Must | tous |
| EX-02-004 | F02 §Cas d'usage (« effet concurrent, rollback ») ; ARC3 §Concurrence | Deux actions concurrentes identiques (double soumission, double activation, double création rejouée) ne produisent qu'un seul effet et une seule trace d'audit ; un échec n'écrit rien (rollback). | Robustesse | Must | UC-02-01, UC-02-04, UC-02-05, UC-02-07, UC-02-03, UC-02-08 |
| EX-02-005 | F02 §Cas d'usage (« audit ») ; F02 §DoD ; ARC3 §Modèle (« immutable audit log ») | Chaque changement (création, identité, profil, zone, capacité, site, soumission) écrit une trace d'audit (auteur, agence, action, ressource, date) dans la même transaction. | Traçabilité | Must | UC-02-01 à UC-02-08 |
| EX-02-006 | CL Règles non négociables ; ARC5 | Une transition de statut (agence, capacité, site, zone) passe par une action dédiée ; jamais par une modification libre du statut. | Conception | Must | UC-02-04, UC-02-05, UC-02-07, UC-02-08, UC-02-03 |
| EX-02-007 | ARC5 (« jamais un CRUD destructeur ») ; CL | Aucune suppression physique : retirer une zone, désactiver un site, suspendre une capacité conservent l'élément et son historique. | Règle | Must | UC-02-03, UC-02-07, UC-02-08 |
| EX-02-008 | ARC3 §Identités (« rôles contextuels ») ; RM-01-01 | Tout compte (particulier ou commerçant) peut créer une agence ; un même compte peut être propriétaire de plusieurs agences. | Fonctionnel | Must | UC-02-01 |
| EX-02-009 | RIA §Accès agence (« la création de l'agence et de son premier propriétaire fait partie du prochain lot ») ; PH B2.1 | L'agence et le membership propriétaire de son créateur sont créés ensemble ou pas du tout. | Fonctionnel | Must | UC-02-01 |
| EX-02-010 | ARC6 | Les événements `AgencyRegistered` et `AgencyCapabilityEnabled` sont émis (audit uniquement, aucun canal externe). | Intégration | Must | UC-02-01, UC-02-04 |
| EX-02-011 | ARC5 ; CL | Erreurs au format Problem Details ; entrées validées strictement (champ inconnu refusé) ; listes paginées par curseur `{ items, nextCursor, hasMore }`. | Contrat | Must | tous |
| EX-02-012 | ARC5 (« `If-Match` / version d'agrégat pour modifications concurrentes sensibles ») | Une modification d'identité, de profil ou de site fondée sur une version périmée est refusée (conflit) au lieu d'écraser silencieusement **[HYPOTHÈSE] : s'applique à ces trois modifications**. | Robustesse | Should | UC-02-02, UC-02-06, UC-02-08 |
| EX-02-013 | RM-01-05 ; RIA §Session | Une session révoquée ou un jeton expiré ne permet aucune action d'onboarding (401). | Sécurité | Must | tous |
| EX-02-014 | F02 §DoD ; ARC1 ADR-05/06 ; CL Hors périmètre | Aucune notification, aucun paiement, aucun abonnement n'est déclenché par l'onboarding. | Contrainte | Must | tous (hors périmètre) |
| EX-02-015 | ARC1 §Points à valider ; PH B2 À VALIDER | Critères de certification, responsables de validation et expiration : **À VALIDER**, non codés en B2. | À VALIDER | — | hors périmètre (B10) |
| EX-02-016 | RDM lot 2 (« équipe ») | La gestion de l'équipe fait partie du lot 2. | Fonctionnel | Must | **déjà implémenté en B1** (UC-01-05 à UC-01-09, DOM §Agences) |

---

## 2. Couverture

| Catégorie | Couvertes | Total | Non couvertes et raison |
|---|---|---|---|
| Cas d'usage de la fiche (UC-02-01 à 08) + UC-02-09 ajouté | 9 | 9 | — |
| Règles de la fiche (RM-02-01 à 04) | 4 | 4 | RM-02-03 : partie « bloque les nouvelles demandes » vérifiable seulement au lot 4 (UC-03-05) ; en B2 on vérifie le statut suspendu et la conservation de l'historique. |
| Exigences transverses (EX-02-001 à 016) | 14 | 16 | EX-02-015 À VALIDER, hors B2 (B10) ; EX-02-016 déjà livrée en B1 (seule la liste des membres manque, anomalie A-09). |

---

## 3. Anomalies du cahier des charges

| # | Type | Constat | Source | Traitement proposé |
|---|---|---|---|---|
| A-01 | Trou | La fiche numérote 8 cas d'usage mais son API indicative expose `GET /agencies/{id}/onboarding` sans cas d'usage associé ; `phases.md` en fait la tâche B2.9. | F02 §Cas d'usage, §API | Cas d'usage ajouté **UC-02-09** (identifiant hors fiche, signalé comme tel). |
| A-02 | Ambiguïté | « compléter identité » (UC-02-02) et « modifier profil » (UC-02-06) se recouvrent sans frontière. | F02 §2, §6 | **[HYPOTHÈSE]** Identité = données vérifiables (raison sociale, siège, contacts, RCCM, NIU), verrouillée après soumission ; profil = données descriptives (nom commercial, description), modifiables en brouillon et soumise. Question Q-03. |
| A-03 | Ambiguïté / doublon | « renseigner zones » (UC-02-03) recoupe « créer zone » de la tarification (UC-05-01, `ServiceZone`). Le filtre « par zone » de la marketplace (UC-03-03) ne dit pas quelle notion il utilise. | F02 §3 ; F05 §1 ; F03 §3 | **[HYPOTHÈSE]** En B2, une zone desservie est une couverture déclarative (ville + quartier facultatif), distincte des zones tarifaires du lot 3 ; leur rapprochement se décide au lot 3. Question Q-07. |
| A-04 | Non testable | RM-02-01 « peut être brouillon » ne dit ni ce qu'un brouillon peut faire, ni s'il expire. | F02 §Règles | Reformulée en §1.2 ; abandon d'un brouillon : question Q-08. |
| A-05 | Trou (À VALIDER) | RM-02-02 : « configuration minimale » jamais définie. | F02 §Règles ; PH B2 À VALIDER | **[HYPOTHÈSE]** livraison : ≥ 1 zone active ; stockage : ≥ 1 site actif. Décision D-04, question Q-02. |
| A-06 | Dépendance | RM-02-03 parle de « nouvelles demandes », qui n'existent qu'au lot 4. L'effet d'une suspension sur les commandes en cours n'est pas dit. | F02 §Règles ; RDM | Vérification du blocage reportée à UC-03-05 (B4) ; **[HYPOTHÈSE]** les commandes et demandes déjà acceptées ne sont pas affectées. Question Q-09. |
| A-07 | Non testable | RM-02-04 « vérification ne signifie pas assurance » est une mise en garde de présentation. | F02 §Règles | Reformulée : aucun attribut « assurée/garantie » ; libellé « soumise à vérification ». Le texte affiché au public relève de B3. |
| A-08 | Statut sans sortie | Le statut `soumise` n'a aucune sortie en B2 : approbation, rejet et retour en brouillon relèvent de B10 (UC-15-03), et la fiche ne prévoit pas de retrait de soumission. | F02 ; F15 §3 ; PH B2 À VALIDER | Statuts après soumission **[HYPOTHÈSE]** (README §Cycle de vie) ; retrait de soumission non prévu en B2. Questions Q-03, Q-04. |
| A-09 | Trou | Le lot 2 inclut « équipe », déjà livrée en B1 ; mais aucune route ne liste les membres d'une agence, alors que F1.3 en a besoin. | RDM lot 2 ; PH F1.3 ; RIA | Signalé ; **non couvert** ici (hors fiche 02). À ajouter comme tâche backend si le user le confirme. Question Q-12. |
| A-10 | Trou | Aucun rôle autorisé n'est fixé pour les opérations d'onboarding ; la fiche renvoie aux « rôles exacts » en question ouverte. | F02 §Questions ouvertes | **[HYPOTHÈSE]** matrice dans README §Matrice des droits. Question Q-05. |
| A-11 | Dépendance circulaire potentielle | RM-10-01 : un entrepôt n'existe que pour une agence stockage ou hybride. Si la configuration minimale du stockage exigeait un entrepôt, l'activation serait impossible. | F10 RM-10-01 ; RM-02-02 | L'hypothèse de configuration minimale du stockage s'appuie sur un **site** (UC-02-08), pas sur un entrepôt. |
| A-12 | Ambiguïté | `AgencyRegistered` (consommateur : admin) : émis à la création du brouillon ou à la soumission ? | ARC6 | **[HYPOTHÈSE]** à la création ; la soumission émet un événement distinct `AgencySubmittedForVerification` (hors catalogue, audit seul). Question Q-10. |
| A-13 | Incohérence mineure | La fiche cite « 400/422 » ; les conventions du projet (`DomainException` → Problem Details) n'ont pas de 422 : les refus de validation métier sont `invalid` (400) ou `conflict` (409). | F02 §Cycle TDD ; CL Erreurs | Suivre `CLAUDE.md` : 400 pour une donnée invalide ou un prérequis manquant à la soumission, 409 pour un état incompatible. |
| A-14 | Trou | Documents justificatifs (RCCM scanné, etc.) cités en question ouverte sans politique de stockage (D-08 ouverte) ni de conservation. | F02 §Questions ouvertes ; F15 §2 | **[HYPOTHÈSE]** aucun dépôt de document en B2 ; justificatifs demandés par l'admin plateforme en B10 (UC-15-02). Question Q-01. |
| A-15 | Trou | Aucun mécanisme n'empêche deux créations involontaires (double clic) ; sans suppression physique, le doublon reste à vie. | F02 §1 (« effet concurrent ») ; ARC5 (idempotence pour « créations à risque de doublon ») | **[HYPOTHÈSE]** clé d'idempotence facultative à la création. Question Q-06. |
| A-16 | Texte générique | Les sections « Objectif et acteurs » et « Questions ouvertes » sont identiques dans toutes les fiches et ne nomment pas les acteurs du module. | F01 à F16 | Acteurs déduits : README §Acteurs. |
| A-17 | Obsolète | `CODEX.md` et ADR-02 imposent Drizzle ; remplacé par TypeORM (décision D-01 du 2026-11-03). | CDX ; ARC1 ADR-02 | Sans effet sur les use cases. |

---

## 4. Glossaire du lot

| Terme | Définition | Source |
|---|---|---|
| Agence | Organisation cliente de la plateforme (tenant), identifiée par `agencyId`, qui offre livraison, stockage ou les deux. | README ; ARC1 ADR-04 |
| Brouillon | Statut initial d'une agence : configurable par son équipe, non soumise à vérification. | RM-02-01 |
| Soumise | Statut d'une agence dont le propriétaire a demandé la vérification ; décision attendue de l'admin plateforme (B10). | F02 §5 |
| Capacité | Service activable séparément : **livraison** ou **stockage** ; une agence hybride a les deux actives. | ARC1 ADR-04 |
| Configuration minimale | Prérequis à l'activation d'une capacité (**[HYPOTHÈSE]**, D-04). | RM-02-02 |
| Zone desservie | Couverture géographique déclarée par l'agence : ville et quartier facultatif. Distincte de la zone tarifaire du lot 3 (**[HYPOTHÈSE]**). | F02 §3 |
| Site | Point physique de l'agence (agence, dépôt, comptoir) : nom, ville, adresse. | F02 §8 (`AgencyLocation`) |
| Identité | Données vérifiables de l'agence : raison sociale, siège, téléphone et e-mail de contact, RCCM, NIU (**[HYPOTHÈSE]**). | PH B2.2 |
| Profil | Données descriptives : nom commercial, description (**[HYPOTHÈSE]**). | F02 §6 |
| Responsable | Propriétaire ou administrateur actif de l'agence (**[HYPOTHÈSE]** de droits). | — |
| Référence d'envoi | Clé d'idempotence fournie par le client pour qu'un envoi rejoué ne crée pas de doublon (**[HYPOTHÈSE]** à la création d'agence, Q-06). | ARC5 |
| Prête à soumettre | Indicateur calculé : tous les prérequis de soumission sont remplis (**[HYPOTHÈSE]**, D-04). | UC-02-09 |
| RCCM | Registre du commerce et du crédit mobilier (immatriculation au Cameroun). | contexte |
| NIU | Numéro d'identifiant unique du contribuable (Cameroun). | contexte |

---

## 5. Matrice de traçabilité

| Exigence | UC-02-01 | UC-02-02 | UC-02-03 | UC-02-04 | UC-02-05 | UC-02-06 | UC-02-07 | UC-02-08 | UC-02-09 |
|---|---|---|---|---|---|---|---|---|---|
| RM-02-01 | X | X | | | X | | | | X |
| RM-02-02 | | | X | X | X | | | X | X |
| RM-02-03 | | | | | | | X | | X |
| RM-02-04 | | | | | X | | | | X |
| EX-02-001 isolation 404 | X | X | X | X | X | X | X | X | X |
| EX-02-002 rôle 403 | | X | X | X | X | X | X | X | |
| EX-02-003 tenant serveur | X | X | X | X | X | X | X | X | X |
| EX-02-004 concurrence | X | | X | X | X | | X | X | |
| EX-02-005 audit | X | X | X | X | X | X | X | X | |
| EX-02-006 action dédiée | | | X | X | X | | X | X | |
| EX-02-007 pas de suppression | | | X | | | | X | X | |
| EX-02-008 compte quelconque | X | | | | | | | | |
| EX-02-009 propriétaire atomique | X | | | | | | | | |
| EX-02-010 événements | X | | | X | X | | X | | |
| EX-02-011 Problem Details, pagination | X | X | X | X | X | X | X | X | X |
| EX-02-012 version | | X | | | | X | | X | |
| EX-02-013 session révoquée | X | X | X | X | X | X | X | X | X |

Le détail règle → scénario → test figure dans la section 0 de chaque use case.

---

## B3 — Tarifs, zones et marketplace publique

Sources lues : `README.md`, `CODEX.md`, `docs/architecture/01` à `03`, `05`, `06`, `docs/delivery/roadmap.md`, `docs/delivery/acceptance.md`, `docs/modules/05-tarifs-zones.md`, `docs/modules/03-marketplace.md` (partie publique) ; pour l'existant : `backend/docs/domains.md`, `events.md`, `routes/agences-onboarding.md`, `routes/groupes-prevus.md`, migration `1793777474207-agency-draft-and-idempotency` (nom provisoire) ; décisions et notes de `progress.md` (D-05, D-13, D-15, D-17, D-19, D-20, note B3.9) et notes de la revue sécurité B2 transmises avec la consigne.

Abréviations supplémentaires : **F05** = `docs/modules/05-tarifs-zones.md` ; **F03** = `docs/modules/03-marketplace.md` ; **PG** = `progress.md` ; **RAO** = `backend/docs/routes/agences-onboarding.md` ; **RSB2** = revue sécurité B2 (note de B3.9 dans PG et consigne du lot).

### B3.1 Inventaire

#### Cas d'usage des fiches

| ID | Source | Énoncé reformulé (vérifiable) | Type | Priorité | Use case(s) |
|---|---|---|---|---|---|
| UC-05-01 | F05 §1 ; PH B3.1 ; D-15 | Toute zone desservie de l'agence (UC-02-03) est une zone tarifable, sans second objet ; elle est « sans tarif » tant qu'aucune version de grille ne la couvre. | Fonctionnel | Must | UC-05-01 (+ UC-02-03 livré) |
| UC-05-02 | F05 §2 ; PH B3.2 | Un responsable corrige le libellé d'une zone active en gardant son identifiant ; les devis émis gardent l'ancien libellé **[HYPOTHÈSE]**. | Fonctionnel | Should | UC-05-02 |
| UC-05-03 | F05 §3 ; PH B3.3 ; D-15 | Une zone retirée (UC-02-03) n'est plus simulée, ni chiffrée en devis, ni acceptée, ni affichée publiquement ; ses lignes de grille sont conservées. | Fonctionnel | Must | UC-05-03 (+ UC-02-03 livré) |
| UC-05-04 | F05 §4 ; PH B3.4 | Un responsable crée la grille de livraison de l'agence (version 1) : tranches de poids par zone, unités explicites, prix XAF entiers **[HYPOTHÈSE] D-05**. | Fonctionnel | Must | UC-05-04 |
| UC-05-05 | F05 §5 ; PH B3.5 | Un responsable publie une nouvelle version complète, fondée sur la version en vigueur ; l'ancienne reste consultable et inchangée ; aucun devis n'est recalculé. | Fonctionnel | Must | UC-05-05 |
| UC-05-06 | F05 §6 ; PH B3.6 | Tout membre obtient un prix indicatif (par colis et total) avec la version en vigueur, sans rien enregistrer. | Fonctionnel | Must | UC-05-06 |
| UC-05-07 | F05 §7 ; PH B3.7 | Tout membre émet un devis daté, référencé, figé à l'émission, valable 7 jours **[HYPOTHÈSE]**. | Fonctionnel | Must | UC-05-07 |
| UC-05-08 | F05 §8 ; PH B3.8 | Tout membre enregistre, une seule fois et avant expiration, l'acceptation d'un devis, qui fige définitivement son prix ; aucune commande n'est créée. | Fonctionnel | Must | UC-05-08 |
| UC-03-01 | F03 §1 ; PH B3.9 ; D-05 | Le propriétaire publie (ou retire) la fiche publique d'une agence soumise ; elle porte la mention « non vérifiée » et ne contient que des champs autorisés. | Fonctionnel | Must | UC-03-01 |
| UC-03-02 | F03 §2 ; PH B3.10 | Un visiteur sans compte parcourt et recherche par nom les fiches visibles, par pages à curseur. | Fonctionnel | Must | UC-03-02 |
| UC-03-03 | F03 §3 ; PH B3.11 | Un visiteur filtre l'annuaire par ville, quartier et capacité (livraison, stockage, hybride). | Fonctionnel | Must | UC-03-03 |
| UC-03-04 | F03 §4 ; PH B3.12 | Un visiteur consulte la fiche visible d'un slug ; toute autre situation donne le même « introuvable ». | Fonctionnel | Must | UC-03-04 |

#### Règles des fiches

| ID | Source | Énoncé source | Reformulation vérifiable | Priorité | Use case(s) |
|---|---|---|---|---|---|
| RM-05-01 | F05 §Règles | « Prix historisé à l'acceptation. » | Un devis fige à l'émission sa version, sa zone et son prix ; l'acceptation les rend définitifs ; aucune version, correction ou retrait de zone ultérieurs ne les modifie (A-22). | Must | UC-05-02, 03, 05, 07, 08 |
| RM-05-02 | F05 §Règles | « zone inactive interdit nouvelles commandes. » | Zone retirée : ni simulation, ni devis, ni acceptation d'un devis émis **[HYPOTHÈSE]**, ni affichage public ; blocage des commandes vérifié en B5 (A-25). | Must | UC-05-03, 07, 08 ; UC-03-03 |
| RM-05-03 | F05 §Règles | « unité poids/volume explicite. » | Tout poids saisi porte `kg` ou `g`, toute dimension `cm` ; une valeur sans unité ou d'unité inconnue est refusée (A-26). | Must | UC-05-04, 05, 06 |
| RM-05-04 | F05 §Règles | « arrondi monétaire cohérent. » | Montants en francs CFA entiers ; poids taxable arrondi au gramme supérieur ; total = somme des prix des colis ; simulation et devis donnent le même total pour les mêmes entrées et la même version **[HYPOTHÈSE] D-05** (A-27). | Must | UC-05-04, 06, 07 |
| RM-05-05 | F05 §Règles | « tarifs spécifiques à agence. » | Une grille appartient à une agence et ne référence que ses zones ; grille, zone ou devis d'une autre agence → introuvable. | Must | UC-05-01, 02, 04 à 07 |
| RM-03-01 | F03 §Règles ; ADR-10 | « Fiche publique n'expose pas clients internes. » | La fiche publique et les résultats de recherche ne contiennent que les champs d'une liste fermée ; aucun client, membre, contact, identifiant légal, adresse, motif ni identifiant interne (A-29). | Must | UC-03-01 à 04 |
| RM-03-05 | F03 §Règles | « tarifs affichés non garantis sans devis. » | Tout prix montré hors devis (simulation, tarifs indicatifs publics) porte la mention « non garanti sans devis ». | Must | UC-05-06 ; UC-03-01, 04 |
| RM-03-02 à 04 | F03 §Règles | demandes | **Hors B3** (B4). | — | — |

#### Exigences transverses du lot

| ID | Source | Énoncé reformulé (vérifiable) | Type | Priorité | Use case(s) |
|---|---|---|---|---|---|
| EX-05-001 | ARC3 §Sécurité ; CL | Non-membre actif (ancien membre, autre agence) → « introuvable » (404) sur agence, zone, grille, devis ; aucune donnée renvoyée. | Sécurité | Must | UC-05-01 à 08 |
| EX-05-002 | D-13 ; RAO | Agent sur une écriture de configuration (zone, grille) → 403. | Sécurité | Must | UC-05-02, 04, 05 |
| EX-05-003 | CDX ; CL | Agence désignée par le chemin ; identifiants de zone, de grille, de devis cherchés dans cette agence seulement ; aucun identifiant d'agence, statut, version ou montant calculé accepté dans le contenu. | Sécurité | Must | UC-05-01 à 08 |
| EX-05-004 | F05 §1 à 8 (« effet concurrent ») ; ARC3 | Actions concurrentes : un seul effet (grille unique, version n+1 unique, acceptation unique, références distinctes, retrait de zone contre émission). | Robustesse | Must | UC-05-02 à 05, 07, 08 |
| EX-05-005 | F05 (« audit ») ; ARC3 §Modèle | Chaque écriture est auditée dans la transaction, avec identifiant de ressource et noms de champs, jamais prix, zones saisies ni données du destinataire. | Traçabilité | Must | UC-05-02, 04, 05, 07, 08 |
| EX-05-006 | ARC5 | Problem Details avec `code` ; validation stricte ; listes `{ items, nextCursor, hasMore }`. | Contrat | Must | tous |
| EX-05-007 | RM-01-05 | Session révoquée ou jeton expiré → 401. | Sécurité | Must | tous |
| EX-05-008 | ARC5 ; CL | Aucune suppression physique de zone, grille, version, devis. | Règle | Must | UC-05-03, 05, 07 |
| EX-05-009 | CL (historisation) ; RM-05-01 | Versions de grille et devis acceptés immuables. | Règle | Must | UC-05-04, 05, 08 |
| EX-05-010 | ARC5 (idempotence des créations à risque) ; D-14 | Émission de devis protégée du double envoi par une clé facultative **[HYPOTHÈSE]**. | Robustesse | Should | UC-05-07 |
| EX-05-011 | F05 §DoD ; ARC1 ADR-05/06 ; CL | Aucun paiement, acompte, notification ni envoi au client. | Contrainte | Must | UC-05-07, 08 |
| EX-05-012 | ARC1 §Points à valider ; PG D-05 | Barèmes, dimensions, taxes, devise, arrondi : **À VALIDER** ; propositions par défaut marquées **[HYPOTHÈSE]**, jamais codées comme vérité sans décision. | À VALIDER | Must | UC-05-04, 06 |
| EX-05-013 | CL (inter-modules) | `pricing` lit zones et capacités par ce qu'`agencies` expose, jamais par ses tables. | Conception | Must | UC-05-01, 03, 04, 07, 08 |
| EX-03-001 | PH B3.10, B3.13 ; RSB2 | Routes publiques sans authentification, débit limité (429). | Sécurité | Must | UC-03-02, 03, 04 |
| EX-03-002 | ADR-10 ; RSB2 | Projection publique en liste fermée, vérifiée par un test anti-fuite (ensemble des clés). | Sécurité | Must | UC-03-01, 02, 04 |
| EX-03-003 | consigne B3 ; ARC3 | Fiche non publiée, retirée, masquée, d'une agence non soumise, ou slug inconnu : même « introuvable » ; jamais dans une liste ni un filtre. | Sécurité | Must | UC-03-01 à 04 |
| EX-03-004 | ARC5 ; consigne B3 | Pagination par curseur, limite bornée, paramètres et filtres en liste fermée. | Contrat | Must | UC-03-02, 03 |
| EX-03-005 | RSB2 ; RAO §Profil | Description restituée comme texte brut ; affichage échappé. | Sécurité | Must | UC-03-01, 04 |
| EX-03-006 | RSB2 | Caractères de format Unicode (`\p{Cf}`) et de contrôle refusés dans les noms publiables et les textes de recherche. | Sécurité | Must | UC-03-01, 02, 03 |
| EX-03-007 | RSB2 | Agences au nom provisoire de migration jamais publiées. | Sécurité | Must | UC-03-01, 02, 04 |
| EX-03-008 | PG D-05 (2026-11-04) | Publiable si soumise et publiée par le propriétaire ; mention « non vérifiée » jusqu'à l'approbation (B10). | Règle | Must | UC-03-01, 02, 04 |
| EX-03-009 | ARC3 §Indices ; PH B3.13 | Requêtes publiques indexées, vérifiées par EXPLAIN (agent `query-perf`). | Performance | Must | UC-03-02, 03 |
| EX-03-010 | ARC6 | La projection reflète profil, zones, capacités, sites et grille sans republication (in-process). | Intégration | Must | UC-03-01, 04 |
| EX-03-011 | D-05 ; ARC3 | Publication : propriétaire seul (403 admin et agent), 404 hors membres actifs ; agence du chemin. | Sécurité | Must | UC-03-01 |
| EX-03-012 | ADR-10 **[HYPOTHÈSE]** | Aucun identifiant interne (agence, zone, membre) dans les réponses publiques ; seul le slug. | Sécurité | Should | UC-03-02, 04 |
| EX-03-013 | F03 (« audit ») | Publication et retrait audités. | Traçabilité | Must | UC-03-01 |
| EX-03-014 | F03 §1 (« effet concurrent ») | Publications concurrentes : un seul effet ; slugs homonymes distincts. | Robustesse | Must | UC-03-01 |

### B3.2 Couverture

| Catégorie | Couvertes | Total | Non couvertes et raison |
|---|---|---|---|
| Cas d'usage des fiches (UC-05-01 à 08, UC-03-01 à 04) | 12 | 12 | UC-05-01 et UC-05-03 : cœur déjà livré par UC-02-03 (D-15), seul le complément B3 est spécifié. |
| Règles du lot (RM-05-01 à 05, RM-03-01, RM-03-05) | 7 | 7 | RM-05-02 « nouvelles commandes » vérifiable en B5 ; RM-03-02 à 04 hors B3 (B4). |
| Exigences transverses (EX-05-001 à 013, EX-03-001 à 014) | 27 | 27 | — |

### B3.3 Anomalies du cahier des charges

| # | Type | Constat | Source | Traitement proposé |
|---|---|---|---|---|
| A-18 | Doublon (résolu) | UC-05-01 « créer zone » et UC-05-03 « désactiver » recoupent UC-02-03, déjà livré. | F05 §1, 3 ; D-15 | Renvoi à UC-02-03 ; seuls les effets B3 sont spécifiés. Ferme aussi A-03 de B2. |
| A-19 | Ambiguïté | « modifier zone » sans contenu ; B2 ne prévoit aucune modification ; changer le secteur d'une zone tarifée brouillerait tarifs et devis. | F05 §2 | **[HYPOTHÈSE]** correction de libellé seulement, même identifiant (Q-27). |
| A-20 | Contradiction | La note de B3.9 dans `progress.md` dit « ne publier que les agences approuvées — D-05 » ; la décision D-05 du 2026-11-04 dit « soumise + mention non vérifiée ». | PG §B3 ; PG Décisions prises | Suivre la décision ; corriger la note (proposé à la session principale). |
| A-21 | Ambiguïté | `POST /quotes/preview` : public ou interne ? | F05 §API ; PH B3.6 | **[HYPOTHÈSE]** interne (membres) ; public : tarifs indicatifs seulement (Q-28). |
| A-22 | Ambiguïté | RM-05-01 « prix historisé à l'acceptation » ne dit pas quel prix vaut entre émission et acceptation si la grille change. | F05 §Règles | **[HYPOTHÈSE]** le devis fige à l'émission et engage pendant sa validité ; l'acceptation le rend définitif. |
| A-23 | Trou | Destinataire d'un devis non défini ; les clients d'agence n'existent qu'en B4. | F05 §7 ; F04 | **[HYPOTHÈSE]** nom + téléphone facultatif, privés (Q-29). |
| A-24 | Trou | Acteur de l'acceptation non défini ; le client n'a pas de canal en B3. | F05 §8 | **[HYPOTHÈSE]** membre au nom du client (Q-32) ; client lui-même en B4. |
| A-25 | Dépendance | RM-05-02 parle de commandes (B5). | F05 §Règles ; RDM | Étendue en B3 à la simulation, au devis et à la fiche ; commandes vérifiées en B5. |
| A-26 | Non testable | RM-05-03 « unité explicite » : saisie, stockage ou affichage ? | F05 §Règles | Reformulée : unité obligatoire à la saisie, stockage normalisé en grammes. |
| A-27 | Non testable | RM-05-04 « arrondi cohérent » sans règle. | F05 §Règles ; D-05 | Reformulée **[HYPOTHÈSE]** (Q-23). |
| A-28 | Trou | `{slug}` cité sans règle de calcul, d'unicité ni de stabilité ; aucun retrait de fiche prévu. | F03 §API | **[HYPOTHÈSE]** slug calculé, unique, stable (Q-38) ; retrait par le propriétaire. |
| A-29 | Trou | RM-03-01 ne vise que les clients internes ; rien sur contacts, RCCM, NIU, adresses, membres. | F03 ; ADR-10 ; RSB2 | Liste fermée explicite (Q-36), test anti-fuite. |
| A-30 | Catalogue incomplet | ARC6 ne cite qu'`AgencyCapabilityEnabled` pour la projection publique ; elle dépend aussi du profil, des zones, des sites, de la soumission, de la suspension et de la grille. | ARC6 ; `events.md` | Lister les événements consommés en S2 (in-process). |
| A-31 | Trou | Ordre des résultats de recherche non spécifié (enjeu d'équité entre agences). | F03 §2 | **[HYPOTHÈSE]** alphabétique (Q-42). |
| A-32 | Ambiguïté | « filtrer par zone » pour une agence de stockage sans zone. | F03 §3 | **[HYPOTHÈSE]** la ville des sites actifs compte (Q-43). |
| A-33 | Trou | Les noms provisoires de migration ne portent aucun indicateur. | migration `1793777474207` ; RSB2 | **[HYPOTHÈSE]** détection par égalité exacte « Agence » + 8 premiers caractères de l'identifiant (Q-41). |
| A-34 | Trou | Aucune tarification du stockage, alors que le stockage est une capacité confirmée (ADR-04). | F05 ; ARC1 | Hors B3 **[HYPOTHÈSE]** (Q-25). |
| A-35 | Trou | Aucune route de lecture des grilles, versions et devis, nécessaires à F1.5. | F05 §API ; PH F1.5 | Tâches B3.14 et B3.15 proposées (Q-46). |
| A-36 | Trou | Validité, expiration et statuts d'un devis absents. | F05 §7, 8 | **[HYPOTHÈSE]** émis / accepté / expiré, 7 jours (Q-30). |
| A-37 | Incohérence | API indicative : `PATCH /rate-cards/{id}` **crée** une version ; `/zones`, `/rate-cards`, `/quotes/preview` sans agence dans le chemin ; « 400/422 » (voir A-13). | F05 §API ; CL | Routes d'action rattachées à l'agence du chemin, à fixer en S2 ; 400 / 409 selon `CLAUDE.md`. |
| A-38 | Dépendance | Les caractères de format (`\p{Cf}`) ne sont pas encore refusés dans le nom commercial (durcissement B2.13 non livré). | PG B2.13 ; RSB2 | Contrôle à la publication et masquage (Q-45) ; livrer B2.13 avant ou avec B3.9. |

### B3.4 Glossaire du lot

| Terme | Définition | Source |
|---|---|---|
| Zone tarifaire | La zone desservie de l'onboarding (ville, quartier facultatif), utilisée comme destination dans la grille. | D-15 |
| Grille tarifaire | Barème de livraison propre à une agence, fait de versions successives. Une par agence **[HYPOTHÈSE]**. | F05 ; RM-05-05 |
| Version (de grille) | Barème complet, numéroté, immuable ; la dernière est « en vigueur ». | PH B3.5 |
| Tranche | Borne supérieure de poids (incluse) et prix associé, pour une zone. **[HYPOTHÈSE] D-05** | Q-20 |
| Poids taxable | Poids réel, ou poids volumétrique s'il est plus grand et que la version a un diviseur ; arrondi au gramme supérieur. **[HYPOTHÈSE]** | Q-21, Q-23 |
| Hors barème | Poids taxable supérieur à la dernière borne de la zone. | RG-05-06-04 |
| Simulation | Calcul indicatif non enregistré. | UC-05-06 |
| Devis | Proposition chiffrée, référencée, datée, figée à l'émission ; émis, accepté ou expiré. | UC-05-07 |
| Prix retenu | Prix du devis : calculé, ou manuel avec motif. **[HYPOTHÈSE]** | Q-31 |
| Fiche publique | Projection en liste fermée d'une agence, publiée par son propriétaire. | F03 ; ADR-10 |
| Fiche visible | Publiée, agence soumise (ou approuvée), une capacité active, nom publiable. | D-05 ; RG-03-01 |
| Slug (adresse publique) | Identifiant lisible et stable de la fiche (`express-douala`). | F03 §API |
| Nom provisoire | Nom attribué par la migration aux agences antérieures : « Agence » + 8 premiers caractères de l'identifiant. | migration `1793777474207` |
| Non vérifiée | Mention d'une agence soumise non encore approuvée par l'admin plateforme. | D-05 |
| Tarifs indicatifs | Prix « à partir de » par zone, non garantis sans devis. | RM-03-05 |

### B3.5 Matrice de traçabilité

| Exigence | 05-01 | 05-02 | 05-03 | 05-04 | 05-05 | 05-06 | 05-07 | 05-08 | 03-01 | 03-02 | 03-03 | 03-04 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RM-05-01 | | X | X | | X | | X | X | | | | X |
| RM-05-02 | | | X | | | | X | X | | | X | |
| RM-05-03 | | | | X | X | X | | | | | | |
| RM-05-04 | | | | X | X | X | X | | | | | |
| RM-05-05 | X | X | | X | X | X | X | | | | | |
| RM-03-01 | | | | | | | | | X | X | X | X |
| RM-03-05 | | | | | | X | | | X | | | X |
| EX-05-001 isolation 404 | X | X | | X | X | X | X | X | | | | |
| EX-05-002 rôle 403 | | X | | X | X | | | | | | | |
| EX-05-003 tenant serveur | X | X | | X | X | X | X | X | | | | |
| EX-05-004 concurrence | | X | X | X | X | | X | X | | | | |
| EX-05-005 audit | | X | | X | X | | X | X | | | | |
| EX-05-008, 009 historique | | | X | X | X | | X | X | | | | |
| EX-05-010 idempotence | | | | | | | X | | | | | |
| EX-05-011 ni paiement ni notification | | | | | | | X | X | | | | |
| EX-05-012 D-05 | | | | X | | X | | | | | | |
| EX-03-001 public, débit | | | | | | | | | | X | X | X |
| EX-03-002 liste fermée | | | | | | | | | X | X | | X |
| EX-03-003 introuvable uniforme | | | | | | | | | X | X | X | X |
| EX-03-004 curseur, filtres | | | | | | | | | | X | X | |
| EX-03-005 description texte | | | | | | | | | X | | | X |
| EX-03-006 `\p{Cf}` | | | | | | | | | X | X | X | |
| EX-03-007 nom provisoire | | | | | | | | | X | X | | X |
| EX-03-008 D-05 publication | | | | | | | | | X | X | | X |
| EX-03-009 index | | | | | | | | | | X | X | |
| EX-03-010 projection à jour | | X | X | | | | | | X | | | X |
| EX-03-011, 013, 014 publication | | | | | | | | | X | | | |
