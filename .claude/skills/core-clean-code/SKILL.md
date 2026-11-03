---
name: "core-clean-code"
description: Qualité du code au niveau classe, méthode et composant, pour toutes les stacks (Java/Spring Boot, TypeScript/NestJS, React + Vite + Redux Toolkit, PHP/Laravel, Python/FastAPI). SOLID utilisé comme détecteur de smells, patterns seulement sur une force nommée, garde-fous anti-overengineering (YAGNI, KISS, règle de trois), règles strictes sur les commentaires. Charge ce skill avant d'écrire, de relire ou de refactorer du code, et dès qu'il faut juger si une abstraction, une interface ou un pattern est justifié. Complète core-ddd et core-hexagonal, qui couvrent la structure.
---

# Clean code — SOLID, patterns, anti-overengineering

Ce skill couvre le **micro** (classe, méthode, composant). La structure (couches, modules, agrégats) relève de `core-hexagonal` et `core-ddd`. Fil rouge : **la chose la plus simple qui fait passer le test**. Une abstraction n'entre que pour un besoin **présent et nommé**.

**Priorité** : si le projet définit ses propres règles (`CLAUDE.md`, `docs/`), elles priment sur ce skill.

## SOLID = détecteurs de smells, pas une cérémonie

L'architecture hexagonale en fournit déjà une partie : DIP par les interfaces de repository et de gateway, SRP par un handler par cas d'usage, OCP par les subscribers d'événements, LSP par l'interchangeabilité des repositories réels et in-memory. Ne les rejoue pas. Traque ce qui reste :

- **SRP** — une classe ou une méthode a deux raisons de changer (handler qui valide, calcule, persiste et notifie à la main au lieu de publier un événement) → sépare.
- **OCP** — un `switch` / `if` sur un type destiné à grossir → polymorphisme ou Strategy **si** les cas se multiplient réellement ; sinon un `switch` sur enum ou du pattern matching suffit.
- **LSP** — une implémentation (in-memory ou réelle) qui lève « non supporté » ou ignore un paramètre → c'est le contrat qui est mauvais.
- **ISP** — un repository ou gateway dont chaque client n'utilise qu'une part → scinde.
- **DIP** — du code métier qui instancie une dépendance concrète (ORM, client HTTP, horloge, générateur d'UUID, `Date.now()`) → injecte une abstraction.

## Patterns — seulement sur une force nommée

Un pattern non justifié **est** un smell. Ceux qui reviennent naturellement dans une architecture hexagonale :

- **Factory statique** — création d'agrégat qui valide ses invariants (`Order.place(...)`), fabrique Request → Command.
- **Value Object** — identifiants, montants, email, téléphone, slug.
- **Décorateur** — transaction autour d'un handler.
- **Observer** — subscribers d'événements de domaine.
- **Builder** — uniquement dans les tests, pour des données lisibles.
- **Strategy / Registry** — plusieurs implémentations d'un même port réellement présentes (deux agrégateurs de paiement, deux fournisseurs d'email).

Pas de catalogue GoF exhaustif.

## Garde-fous anti-overengineering (le cœur)

- **YAGNI / KISS** — code le besoin d'aujourd'hui. Aucun paramètre, flag ou point d'extension « pour plus tard ».
- **Règle de trois** — pas d'abstraction avant la 3e occurrence réelle. Deux cas similaires ne font pas une abstraction.
- **Test décisif** — avant d'abstraire : peux-tu nommer le 2e usage concret et présent ? Non → inline.
- **Interfaces** — un repository ou un gateway garde son interface même avec une seule implémentation (c'est la couture hexagonale, et le fake in-memory des tests en est la 2e). Une classe interne, non.
- **Simplicité** — une fonction ou un record simple plutôt qu'une hiérarchie. Supprime avant d'ajouter.

## Commentaires — par défaut, on n'en écrit pas

Le code dit ce qu'il fait, git dit ce qui a changé, `docs/` dit pourquoi l'architecture est ainsi. Il ne reste au commentaire que **l'invariant non déductible du code dont l'ignorance casse quelque chose**.

Test avant d'écrire : « qu'est-ce qui casse si le prochain lecteur ne lit pas ça ? » Pas de réponse concrète → pas de commentaire.

À supprimer à vue, y compris dans le code existant que tu touches :

- le journal des modifications (« corrigé », « désormais », « avant ça valait X ») — ça va dans le commit ;
- la paraphrase de la ligne en français ;
- la pédagogie sur le framework (Spring, React, NestJS…) ;
- la Javadoc / JSDoc / docstring qui reformule la signature, sauf si elle ajoute une unité, une borne ou un effet de bord ;
- la réponse à un relecteur écrite dans le code ;
- le code commenté — git le garde ;
- la mise en scène (capitales, ⚠️ en série, paragraphes rhétoriques).

Bornes contrôlables : un commentaire tient en **3 lignes maximum**, aucun bloc de plus de 5 lignes, un fichier au-delà d'environ **15 %** de lignes de commentaire est suspect. Une prose fausse est pire que pas de prose.

## Limites concrètes

- Méthodes courtes, peu de paramètres. Pas de paramètre booléen : une méthode à l'intention explicite (`activate()` plutôt que `setActive(true)`).
- Early return plutôt qu'imbrication ; pas plus de 2 à 3 niveaux.
- Noms tirés du langage métier du projet (glossaire, cahier des charges), pas d'abréviations obscures.
- Immuabilité par défaut : `record` en Java, `readonly` / `as const` en TypeScript, `readonly` en PHP 8.2+, `@dataclass(frozen=True)` en Python.
- Java : pattern matching plutôt que casts ; `Optional` en retour uniquement, jamais en paramètre ni en champ.
- TypeScript : pas de `any`, pas de `as unknown as X` ; type guards et unions discriminées.

## Spécifique front

- Logique hors des composants (use case, thunk, slice, sélecteur, listener, hook `use*`). Un composant qui calcule du métier est un smell.
- Pas de prop-drilling profond, pas de thunk ou d'action dupliqués.
- Composants petits et composables ; réutilise `components/ui/` (shadcn) avant d'en créer ; pas de composant « générique » avant un 2e usage réel.

## Avant de conclure

- [ ] Chaque abstraction ajoutée répond-elle à un besoin présent et nommé ?
- [ ] Le smell détecté a-t-il reçu le correctif minimal, ni sous- ni sur-corrigé ?
- [ ] Aurais-tu pu faire plus simple à couverture de test égale ?
- [ ] Chaque commentaire survivant porte-t-il un invariant non déductible, en 3 lignes maximum ?
