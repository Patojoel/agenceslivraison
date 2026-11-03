---
name: revue-et-correction
description: Passer en revue le code qui vient d'être implémenté, détecter les erreurs et les corriger avec la bonne stratégie plutôt qu'en masquant les symptômes. À utiliser dès que l'utilisateur demande de relire, vérifier, auditer, valider, contrôler, « repasser sur », consolider ou fiabiliser ce qui a été fait — mais aussi de son propre chef à la fin de toute implémentation non triviale, avant d'annoncer que c'est terminé. Se déclenche également face à un typecheck ou des tests en échec, un comportement inattendu, une régression, un doute sur la qualité d'un module, ou une demande de « corrige les erreurs ». Ne pas utiliser pour une simple exécution de tests sans analyse, ni pour une revue de code tiers que l'utilisateur ne cherche pas à corriger.
---

# Revue et correction

Une implémentation qui compile n'est pas une implémentation correcte. Ce skill sert à repasser sur ce qui vient d'être produit, à trouver ce qui est faux ou fragile, et à corriger de manière à ce que le problème ne revienne pas — plutôt qu'à le faire disparaître de l'écran.

La distinction centrale : **faire taire un signal d'erreur n'est pas une correction.** Un `any`, un `@ts-ignore`, un `eslint-disable`, un test désactivé ou un `catch` vide transforment une erreur visible en erreur invisible. C'est strictement pire que l'état initial.

## Procédure

### Phase 0 — Délimiter le périmètre

Avant toute chose, établir ce qui est revu. Sans périmètre, la revue dérive vers l'ensemble du dépôt et ne produit rien d'actionnable.

Par défaut, le périmètre est **ce qui a été modifié récemment** : consulter le diff (`git status`, `git diff`, `git diff --stat HEAD~1`) ou, à défaut, la liste des fichiers touchés dans la session. Si l'utilisateur désigne un module ou une fonctionnalité, prendre ce périmètre et y inclure ses appelants directs — un changement correct en lui-même peut casser ce qui le consomme.

Annoncer le périmètre en une ligne avant de commencer.

### Phase 1 — Récolter les signaux automatiques

Toujours commencer par là : c'est objectif, rapide, et cela oriente le reste de la revue. Lancer, dans cet ordre, ce qui existe dans le projet :

1. **Typecheck** — le signal le plus dense en information par seconde.
2. **Lint** — distinguer les erreurs réelles du bruit de configuration.
3. **Tests** — unitaires, puis intégration, puis end-to-end.
4. **Build** — certaines erreurs n'apparaissent qu'à la compilation de production.
5. **Audit de dépendances**, si le périmètre touche au `package.json`.

Noter le nombre exact d'erreurs de chaque catégorie **avant** toute correction. C'est la seule référence qui permettra ensuite de prouver un progrès, et de détecter une correction qui en casse une autre.

Si l'une de ces commandes n'existe pas dans le projet, le signaler : son absence est en soi une conclusion de la revue.

### Phase 2 — Revue manuelle par axes

Les outils ne voient ni les erreurs de logique, ni les violations d'architecture, ni les failles d'autorisation. Parcourir le périmètre selon les axes suivants, en s'arrêtant sur ceux qui s'appliquent réellement.

**Frontières d'architecture.** Le sens des dépendances est-il respecté ? Un fichier de domaine qui importe l'ORM, le framework HTTP ou un composant d'interface est une violation, pas un raccourci. Côté frontend, un composant qui appelle directement `fetch` ou `axios`, un sélecteur défini en ligne dans un composant, une donnée chargée dans un `useEffect` : mêmes catégories de violation.

**Conformité à l'intention.** Le code fait-il ce que la demande décrivait, ou ce qui était facile à écrire ? Relire la demande initiale, pas seulement le code. Les cas non traités — liste vide, valeur nulle, quantité zéro, première utilisation, concurrence — sont plus souvent la source des bugs que la logique principale.

**Types.** Chercher les `any` explicites ou implicites, les doubles assertions, les types trop larges qui laissent passer des états impossibles, les retours non typés en frontière d'API. Un type qui autorise un état invalide finira par le rencontrer.

**Validation et frontière de confiance.** Toute donnée qui vient de l'extérieur — corps de requête, paramètres d'URL, réponse d'API tierce, contenu de stockage local — est-elle validée avant d'entrer dans le système ? La validation doit être à la frontière, pas dispersée au milieu de la logique.

**Gestion d'erreur.** Les erreurs sont-elles propagées avec leur sens, ou aplaties en booléen, en chaîne de caractères, ou avalées ? Un `catch` qui journalise puis continue comme si de rien n'était masque la panne au lieu de la traiter. Vérifier aussi qu'un échec laisse le système dans un état cohérent.

**Sécurité et autorisation.** Un identifiant reçu du client permet-il d'atteindre une ressource qui n'appartient pas à l'appelant ? Les règles d'autorisation s'appliquent-elles aussi aux **listes, exports et recherches**, ou seulement aux accès unitaires — c'est la fuite la plus fréquente. Aucun secret en clair, aucune donnée interne dans une réponse publique, aucun contrôle de sécurité qui n'existe que côté client.

**Persistance.** Transactions autour des écritures multiples, index sur les colonnes filtrées et triées, requêtes N+1, migrations réversibles, valeurs monétaires en entiers plutôt qu'en flottants.

**État et effets côté frontend.** Effets sans dépendances correctes ou sans nettoyage, état dérivé stocké au lieu d'être calculé, données sensibles persistées, rendus en cascade, clés de liste instables.

**Accessibilité.** Libellés associés aux champs, navigation au clavier, focus visible, contrastes, information jamais portée par la seule couleur, textes alternatifs.

**Tests.** Les tests portent-ils sur le comportement ou sur l'implémentation ? Un test qui ne peut pas échouer ne teste rien. Vérifier que les cas limites et les chemins d'erreur sont couverts, pas seulement le chemin nominal.

**Cohérence et dette.** Code mort, duplication introduite, nommage divergent de la convention du dépôt, chaînes d'interface écrites en dur au lieu d'être traduites, `TODO` laissés sans suite, fichiers oubliés.

### Phase 3 — Classer avant de corriger

Lister toutes les constatations avant d'en corriger une seule. Corriger au fil de l'eau fait perdre la vue d'ensemble et masque les causes communes.

| Niveau | Définition | Traitement |
|---|---|---|
| **Bloquant** | Casse en production, perte ou fuite de données, faille d'autorisation, build ou tests rouges | Corriger immédiatement |
| **Majeur** | Violation d'architecture, absence de validation, cas limite non traité, erreur avalée | Corriger dans cette passe |
| **Mineur** | Nommage, duplication limitée, test manquant sur un chemin secondaire | Corriger si le périmètre est déjà ouvert |
| **Suggestion** | Amélioration hors périmètre, refonte souhaitable | Signaler, ne pas exécuter |

La dernière ligne compte autant que les autres : une revue qui se transforme en refonte non demandée détruit la confiance dans la revue.

### Phase 4 — Corriger avec la bonne stratégie

Choisir la stratégie en fonction de la nature du problème, pas de la facilité de la correction.

| Situation | Stratégie |
|---|---|
| Symptôme isolé, cause identifiée avec certitude | Correction locale, puis revérification |
| La même erreur apparaît à plusieurs endroits | Corriger la cause commune — type, utilitaire, contrat — jamais les occurrences une par une |
| Erreur de typage répétitive | Renforcer le type à la source ; si le type est juste, c'est l'usage qu'il faut corriger |
| Violation de frontière de couche | Déplacer le code du bon côté de la frontière ; ne jamais assouplir la règle pour accommoder le code |
| Test en échec | Déterminer d'abord si c'est le code ou le test qui a tort. Ne modifier un test que si l'on peut expliquer pourquoi il était faux |
| Bug signalé mais non reproduit | Écrire d'abord le test qui le reproduit. Sans reproduction, il n'y a pas de correction, seulement une hypothèse |
| Code trop couplé pour être corrigé proprement | Isoler d'abord derrière un contrat, corriger ensuite. Deux étapes, deux vérifications |
| Correction large, risquée, à effets diffus | Revenir en arrière et replanifier plutôt que d'empiler des rustines |
| Cause réelle hors périmètre | Ne pas corriger en silence : signaler, proposer, attendre |

**Une classe de problème à la fois.** Corriger tous les problèmes de typage, revérifier, puis passer aux violations d'architecture, revérifier, et ainsi de suite. Mélanger les catégories dans une seule passe rend impossible d'attribuer une nouvelle erreur à sa cause.

**Revérifier après chaque classe corrigée.** Comparer au décompte de la phase 1. Une correction qui fait apparaître deux erreurs ailleurs n'est pas une correction : c'est un déplacement de problème, et il faut le dire.

### Phase 5 — Verrouiller

Pour chaque problème bloquant ou majeur corrigé, se demander ce qui empêchera sa réapparition. Selon le cas : un test qui échoue avant la correction et passe après, un type qui rend l'état invalide inexprimable, une règle de lint, une contrainte en base, une validation à la frontière.

Sans ce verrou, la même erreur reviendra — souvent introduite par la personne qui l'avait corrigée.

**Dans ce projet** : reporter le résultat dans `progress.md` à la racine (cases vérifiées, ligne de journal avec les commandes exécutées, problèmes restants en `[~]` ou en décision ouverte).

## Interdits

Ces raccourcis rendent le code **moins sûr qu'avant la revue**. Ne jamais les utiliser pour faire passer une vérification, quelle que soit la pression :

- `any`, `as unknown as X`, ou un type élargi pour faire taire le compilateur
- `@ts-ignore` ou `@ts-expect-error` sans commentaire expliquant précisément pourquoi le compilateur a tort
- `eslint-disable` sur une règle qui signale un vrai problème
- `.skip`, `.only`, une assertion supprimée, ou un test réécrit pour correspondre au comportement fautif
- Un `catch` vide ou qui se contente de journaliser pour continuer
- Un délai d'attente augmenté pour masquer une condition de concurrence
- Du code commenté au lieu d'être supprimé
- Une valeur codée en dur pour faire passer un cas précis

Quand la seule correction disponible passerait par l'un de ces raccourcis, la vraie conclusion est que le problème est plus profond. Le dire explicitement et proposer la correction de fond est plus utile qu'un vert artificiel.

## Format du rapport

Toujours restituer la revue dans cette forme, avant ou après les corrections selon ce que l'utilisateur a demandé :

```markdown
## Périmètre
[Ce qui a été revu.]

## Signaux automatiques
| Vérification | Avant | Après |
|---|---|---|
| Typecheck | N erreurs | N erreurs |
| Lint | N | N |
| Tests | N/N | N/N |

## Constatations

### Bloquant
- `fichier:ligne` — [problème] → [correction appliquée ou proposée]

### Majeur
- `fichier:ligne` — [problème] → [correction]

### Mineur
- ...

### Signalé, non corrigé (hors périmètre)
- [problème] — [pourquoi c'est hors périmètre, ce que ça coûterait de le traiter]

## Verrous ajoutés
- [Test, type, contrainte ou règle qui empêche la réapparition]

## Reste à faire
- [Ce qui n'a pas pu être vérifié ou corrigé, et pourquoi]
```

Si la revue ne trouve rien de bloquant ni de majeur, le dire clairement plutôt que de gonfler la liste avec des remarques cosmétiques. Une revue honnêtement vide est une information ; une revue remplie pour paraître rigoureuse fait perdre du temps et décrédibilise les suivantes.

## Anti-modèles

| À éviter | Pourquoi |
|---|---|
| Corriger au fil de la lecture | Fait perdre les causes communes et transforme la revue en bricolage |
| Annoncer « corrigé » sans relancer les vérifications | La seule preuve d'une correction est le signal, pas l'intention |
| Réécrire du code correct au passage | Élargit le diff, dilue la revue, et introduit des régressions dans du code qui fonctionnait |
| Traiter chaque occurrence d'une même erreur séparément | La onzième occurrence apparaîtra la semaine suivante |
| Signaler un problème sans proposer de correction | Une revue sans stratégie de correction n'est qu'une liste de reproches |
| Corriger un problème hors périmètre sans le dire | L'utilisateur perd la trace de ce qui a changé et pourquoi |
| Conclure « tout est bon » après un seul typecheck | Le typecheck ne voit ni la logique, ni l'autorisation, ni l'architecture |
