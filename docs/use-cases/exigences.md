# Exigences — inventaire, anomalies et traçabilité

Spécification exécutable issue du cahier des charges (`docs/cahier-des-charges/`, lecture seule). Chaque exigence garde l'identifiant de la source quand il existe (`UC-02-0x`, `RM-02-0x`) ; les exigences transverses reçoivent un identifiant `EX-02-NNN`.

| Lot | Phase | Fiche | Date | Rédacteur |
|---|---|---|---|---|
| 2 — Onboarding agence | B2 (S1) | `docs/modules/02-agences-onboarding.md` | 2026-11-03 | `use-case-writer` |

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
