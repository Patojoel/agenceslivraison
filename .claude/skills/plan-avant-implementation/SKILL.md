---
name: plan-avant-implementation
description: Produire un plan d'implémentation validé avant d'écrire la moindre ligne de code. À utiliser systématiquement dès que la demande implique de créer, modifier, refactorer, brancher ou supprimer du code — nouvelle fonctionnalité, nouveau module, nouvel endpoint, nouvel écran, correction non triviale, migration, changement de dépendance, refonte d'architecture. Se déclenche même quand l'utilisateur formule sa demande directement en mode « fais X » sans demander de plan, et même quand la tâche paraît simple, car la plupart des erreurs coûteuses viennent d'une implémentation lancée avant que le périmètre et les frontières de couches soient posés. Ne pas utiliser pour les questions purement explicatives, la lecture de code sans modification, ou une réponse conversationnelle.
---

# Plan avant implémentation

Écrire du code est bon marché. Écrire le mauvais code au mauvais endroit coûte cher : il faut le détecter, le comprendre, le défaire, et souvent défaire aussi ce qui s'est appuyé dessus. Ce skill impose une étape de cadrage courte et explicite avant toute écriture, pour que l'utilisateur puisse corriger l'intention avant qu'elle ne devienne du code.

## Principe

**Aucune écriture de fichier avant qu'un plan ait été présenté et validé.**

La seule exception est l'exploration en lecture seule — lire des fichiers, lister une arborescence, lancer un `git log`, un typecheck ou une recherche. Cette exploration est même obligatoire : un plan écrit sans avoir regardé le code existant est une supposition, pas un plan.

## Calibrer l'effort

Un plan de trente lignes pour renommer une variable est aussi nuisible qu'une absence de plan : l'utilisateur arrête de les lire. Calibrer selon la surface réellement touchée.

| Ampleur | Signal | Format du plan |
|---|---|---|
| Triviale | Un fichier, aucun contrat modifié, aucune décision | Deux à trois lignes en prose, puis exécuter directement |
| Moyenne | Deux à cinq fichiers, ou une couche traversée, ou un choix technique | Plan court : objectif, découpage, un risque |
| Importante | Nouveau module, nouvel agrégat, migration, changement d'API, refonte | Plan complet (template ci-dessous) et attente explicite de validation |
| Incertaine | Le périmètre réel est inconnu avant exploration | Explorer d'abord, puis plan complet |

En cas de doute entre deux niveaux, prendre le plus élevé. Un plan trop détaillé se lit en trente secondes ; une implémentation partie dans la mauvaise direction se paie en heures.

## Procédure

### 1. Reformuler la demande

Une à deux phrases : ce qui est demandé, et le résultat observable attendu. Si la reformulation ne tient pas en deux phrases, c'est que la demande contient plusieurs tâches — les séparer et traiter la première.

### 2. Explorer le code existant

Ne jamais planifier contre un code imaginé. Avant d'écrire le plan, vérifier réellement :

- La convention en vigueur pour ce type de fichier — chercher un module ou un composant équivalent déjà présent et s'en inspirer plutôt que d'inventer une structure.
- Ce qui existe déjà et pourrait être réutilisé, étendu ou dupliqué par erreur.
- Les contrats en jeu : interfaces, ports, types partagés, schémas de validation, endpoints, colonnes de base.
- Ce qui consomme le code à modifier — les appelants déterminent l'ampleur réelle d'un changement.
- L'état des vérifications automatiques : est-ce que le typecheck, le lint et les tests passent **avant** l'intervention ? Sans cette base, il sera impossible d'attribuer une régression.

Reporter dans le plan ce qui a été effectivement observé, pas ce qui est supposé. Une ligne « je n'ai pas trouvé de convention existante pour X » est une information utile ; une convention inventée ne l'est pas.

### 3. Choisir une approche

Quand plusieurs approches sont viables, en présenter deux au maximum, avec le compromis en une ligne chacune, puis **recommander explicitement**. Ne jamais renvoyer le choix à l'utilisateur sans recommandation : il demande un plan, pas un menu.

Quand une seule approche est viable, ne pas fabriquer d'alternative de façade.

### 4. Découper

Chaque étape doit être : un fichier ou un groupe de fichiers cohérent, ce qui y est fait, et pourquoi. L'ordre compte — le découpage doit être tel que le projet compile et que les tests passent au maximum d'étapes intermédiaires possibles, en partant du domaine vers l'extérieur.

Ordre par défaut, du plus interne au plus externe :

1. Types, modèles, entités du domaine
2. Contrats — ports, interfaces, schémas de validation
3. Logique applicative — cas d'usage, handlers, thunks
4. Adaptateurs — persistance, HTTP, stockage
5. Points d'entrée — contrôleurs, routes, composants
6. Câblage — injection de dépendances, enregistrement de modules, reducers, routeur
7. Tests

Ce sens est le seul qui permette de tester chaque étape sans avoir à écrire les suivantes.

### 5. Nommer les impacts et les risques

Répondre à trois questions, honnêtement :

- Qu'est-ce qui casse ? Appelants existants, contrats publics, données en base, comportement observable.
- Qu'est-ce qui devient incohérent si on s'arrête à mi-chemin ?
- Qu'est-ce qui n'est pas couvert par ce plan et qu'on remet à plus tard ?

Un plan qui ne présente aucun risque sur une tâche non triviale est un plan incomplet.

### 6. Poser les questions bloquantes

Si une décision appartient à l'utilisateur — format de données, comportement métier ambigu, dépendance à ajouter, compromis performance/simplicité — la poser **avant** l'implémentation, pas après.

Distinguer les vraies questions bloquantes des détails : trois questions maximum, et pour chacune, proposer une réponse par défaut afin que l'utilisateur puisse répondre « ok » plutôt que rédiger.

### 7. Définir la vérification

Comment saura-t-on que c'est fait et correct ? Commande de typecheck, de lint, de test, comportement à observer manuellement. Si aucun moyen de vérification n'existe, l'étape la plus utile du plan est souvent d'en créer un.

### 8. Attendre la validation

Présenter le plan, puis s'arrêter. Ne pas enchaîner sur l'implémentation dans le même message pour une tâche moyenne ou importante.

Pour une tâche triviale, annoncer ce qui va être fait en deux lignes puis exécuter — attendre une validation pour renommer une variable est du zèle inutile.

## Template de plan

Pour les tâches moyennes et importantes :

```markdown
## Objectif
[Une à deux phrases : ce qui est demandé, résultat observable attendu.]

## Ce que j'ai vérifié
- [Fichier ou zone consultée → ce qui en ressort]
- [Convention existante identifiée, ou absence de convention]
- [État des vérifications avant intervention]

## Approche
[Approche retenue en deux à trois phrases.]
[Si pertinent : alternative écartée + raison en une ligne.]

## Découpage
1. `chemin/du/fichier` — [ce qui est fait] — [pourquoi]
2. `chemin/du/fichier` — [ce qui est fait] — [pourquoi]
3. ...

## Impacts et risques
- [Ce qui casse / ce qui doit être mis à jour ailleurs]
- [Ce qui reste hors périmètre]

## À trancher
- [Question] — proposition par défaut : [réponse]

## Vérification
- [Commande ou observation qui prouve que c'est fait]
```

## Adapter le plan à l'architecture du projet

Le découpage doit refléter les frontières de couches réelles du projet, pas une structure générique. Avant de planifier, identifier l'architecture en place et faire apparaître les couches concernées dans le découpage.

**Backend hexagonal / DDD / CQRS** — vérifier que le plan respecte le sens des dépendances : le domaine n'importe jamais l'infrastructure ni la présentation. Une étape qui ajoute un import de l'ORM dans un fichier de domaine est une erreur de plan, pas d'implémentation. Séparer explicitement l'agrégat, le port, le handler de commande ou de requête, l'adaptateur de persistance, le contrôleur, et le câblage du module.

**Frontend Clean Architecture** — même contrainte : les modèles et les gateways (ports) ne connaissent ni les composants ni l'implémentation HTTP. Faire apparaître le modèle, le contrat de gateway, le triplet cas d'usage (commande, réponse, thunk), le slice et ses sélecteurs, l'implémentation HTTP du gateway, les composants, puis les trois points de câblage habituels — conteneur de dépendances, reducer racine, routeur. Ces trois derniers sont les plus souvent oubliés et produisent des erreurs à l'exécution plutôt qu'à la compilation : les inscrire au plan.

**Projet sans architecture explicite** — le plan doit suivre la convention majoritaire du dépôt, pas la préférence du moment. Si le dépôt est incohérent, le signaler dans les risques et proposer une convention plutôt que d'en ajouter une troisième.

## Après validation

Suivre le plan dans l'ordre annoncé. Si l'implémentation révèle que le plan était faux — un contrat différent de ce qui était supposé, une dépendance manquante, une étape impossible dans cet ordre — **s'arrêter et le dire** avec la correction proposée, plutôt que d'improviser silencieusement une autre approche. Un plan qui diverge sans que l'utilisateur le sache est pire qu'une absence de plan : il donne une fausse impression de contrôle.

À la fin, indiquer en deux lignes ce qui a été fait et ce qui reste, en reprenant la numérotation du plan.

## Anti-modèles

| À éviter | Pourquoi |
|---|---|
| Écrire le code puis présenter le plan comme un résumé | Le plan sert à corriger l'intention avant le coût, pas à décrire après coup |
| Un plan générique qui ne cite aucun fichier réel | Signe que le code existant n'a pas été lu ; le plan sera faux |
| Lister dix questions ouvertes | Déporte la charge sur l'utilisateur ; trois questions maximum, avec une réponse par défaut |
| Planifier une refonte non demandée | Le périmètre est celui de la demande ; les améliorations repérées se signalent séparément, sans être exécutées |
| Un plan complet pour une tâche triviale | L'utilisateur cesse de lire les plans, et le skill devient contre-productif |
| Enchaîner l'implémentation sans attendre sur une tâche importante | Supprime le seul moment où la correction est bon marché |
| Annoncer « je vais faire X, Y, Z » sans avoir lu le code | Une liste d'intentions n'est pas un plan |
