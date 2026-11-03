# Gabarit d'un use case

```markdown
# UC-<NNN> — <Titre à l'infinitif>

| Champ | Valeur |
|---|---|
| Statut | Brouillon / Prêt pour revue / Validé / Prêt pour dev |
| Priorité | Must / Should / Could |
| Domaine | <domaine du projet, tel que dans docs/domains.md> |
| Date | AAAA-MM-JJ |
| Use cases liés | UC-xxx (inclut), UC-yyy (étend) |
| Exigences couvertes | EX-001, EX-004 |

## 0. Traçabilité
| Exigence | Source | Où elle est traitée |
|---|---|---|

## 1. Objectif
Une ou deux phrases : quelle valeur métier, pour qui.

## 2. User story
> En tant que **<rôle>**, je veux **<capacité>**, afin de **<bénéfice>**.

## 3. Acteurs
Principal ; secondaires (autres utilisateurs, systèmes externes, tâches planifiées).

## 4. Déclencheur

## 5. Préconditions (vérifiables)

## 6. Postconditions
Succès : état garanti. Échec : état garanti (rien modifié, rollback, trace).

## 7. Règles métier
| ID | Règle | Exemple | Source |
|---|---|---|---|
| RG-<NNN>-01 | … | … | EX-001 (§…) |

## 8. Flux nominal (moins de 12 étapes)

## 9. Flux alternatifs
A1 — <condition> (étape n) : …, retour à l'étape m.

## 10. Flux d'exception
E1 — <erreur> (étape n) : le système … ; message : « … » ; fin.

## 11. Workflow
Mermaid : `flowchart` (processus), `stateDiagram-v2` (cycle de vie), `sequenceDiagram` (échanges entre systèmes).

## 12. Scénarios d'acceptation (Gherkin)
Fonctionnalité, Contexte, scénarios nominal / alternatifs / erreurs ; `Plan du scénario` + `Exemples` pour les valeurs limites.
Tags : `@UC-<NNN>`, `@RG-<NNN>-xx`, `@EX-xxx`, `@nominal` / `@alternatif` / `@erreur` / `@securite`.

## 13. Plan de tests TDD
| # | Niveau | Comportement | Étant donné | Quand | Alors | Règle |
|---|---|---|---|---|---|---|
Du cas dégénéré au plus complexe ; un test par règle, un par valeur limite. Niveaux : unit (fakes in-memory), feature (vraie base), E2E (HTTP ; seul niveau pour une lecture).

## 14. Données
Entrées (champ, type métier, obligatoire, contraintes) ; sorties ; jeux de données de test.

## 15. Exigences non fonctionnelles (mesurables)

## 16. Hors périmètre

## 17. Questions ouvertes
| # | Question | Hypothèse retenue | Impact si différent |
|---|---|---|---|

## 18. Notes pour le tech lead
Découpage en tranches verticales ; points de vigilance (concurrence, idempotence, volumétrie, données sensibles).
Definition of Ready :
- [ ] Chaque exigence de la section 0 a au moins un scénario
- [ ] Chaque règle a un exemple
- [ ] Chaque flux d'exception a un scénario
- [ ] Aucune question bloquante
- [ ] Le plan TDD couvre chaque règle
- [ ] Le `.feature` est synchronisé avec la section 12
```

# Bonnes pratiques Gherkin

À faire :

```gherkin
# language: fr
@UC-012 @RG-012-03 @erreur
Scénario: Refus d'une seconde inscription à la même session
  Étant donné la participante "Awa Ngono" inscrite à la session "Juin 2026"
  Quand l'agent inscrit "Awa Ngono" à la session "Juin 2026"
  Alors l'inscription est refusée
  Et le motif indiqué est "Déjà inscrite à cette session"
  Et le nombre d'inscrits à la session "Juin 2026" reste inchangé
```

À éviter : titre non descriptif, chemins d'URL, sélecteurs CSS, temporisations, vérification directe en base.

Règles : titre lisible seul dans un rapport ; `Étant donné` décrit un état ; `Alors` vérifie un résultat observable ; voix déclarative ; 3 à 7 étapes par scénario.

# Checklist qualité

- [ ] Source lue en entier, non modifiée
- [ ] Chaque règle, flux et scénario rattaché à une exigence ou marqué `[HYPOTHÈSE]`
- [ ] `exigences.md` à jour, anomalies listées
- [ ] Vocabulaire du glossaire, nouveaux termes ajoutés
- [ ] Chaque règle : un ID, un exemple, au moins un scénario
- [ ] Erreurs couvertes : saisie invalide, droits, doublon, état incohérent, service tiers indisponible
- [ ] Valeurs limites par `Plan du scénario`
- [ ] Aucun détail d'implémentation dans les scénarios
- [ ] Diagramme Mermaid conforme aux flux
- [ ] Hypothèses reprises dans les questions ouvertes
- [ ] Index `docs/use-cases/README.md` à jour
