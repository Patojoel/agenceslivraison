---
name: "core-front-stack"
description: Idiomes frontend génériques pour tous les projets React — SPA Vite + Redux Toolkit en architecture hexagonale, ou Next.js App Router — avec TypeScript strict, Tailwind, shadcn/ui, React Hook Form + Zod, i18n, accessibilité, HTTP centralisé et intégration des backends (Spring Boot, NestJS, Laravel, FastAPI). Charge ce skill avant d'écrire ou de modifier du code frontend, de créer un use case, un thunk, un slice, une Server Action, un gateway, un formulaire ou un écran, ou d'intégrer un endpoint backend. Contient une référence par framework et une par backend dans references/.
---

# Front-stack — règles communes et références

**Priorité** : la structure réelle du dépôt, `CLAUDE.md` et `docs/frontend*.md` priment. Sur un projet existant, ouvre un module voisin et reproduis sa structure exacte (certains projets placent le port dans `models/gateway/` et l'adapter dans `infra/repo/`, d'autres dans `gateway/` et `infra/repo/` : suis l'existant).

## Étape 1 — Identifier le framework et le backend

| Indice | Référence à lire |
| --- | --- |
| `vite.config.ts` + `@reduxjs/toolkit` | `references/vite-rtk.md` |
| `next.config.*` + dossier `app/` | `references/nextjs.md` |
| Backend (fiche projet ou appels existants) | `references/backend-integration.md`, section du backend concerné |

## Règles communes (toutes stacks)

**TypeScript**
- Mode strict. Aucun `any`, aucun `as unknown as X` : type guards et unions discriminées.
- Exports nommés partout ; export par défaut uniquement pour les pages chargées en lazy ou imposées par le framework.
- `interface` pour les formes d'objet, `type` pour les unions, intersections et types mappés.
- Props typées explicitement ; composants en `const` fléchées.
- Alias `@/` vers `src/` ; jamais de `../../`.

**HTTP**
- Un seul fournisseur HTTP centralisé. Jamais de `fetch` ou d'`axios` direct dans un composant ou un hook.
- Réponses typées à la frontière (adapter ou query) avec `Zod.parse()` : on ne fait jamais confiance à la forme d'une réponse.
- Erreurs gérées de façon centrale : 400/422 (validation → erreurs de champ), 401 (connexion), 403 (masquer ou rediriger), 404, 500.
- Conversion snake_case → camelCase dans l'adapter, jamais dans l'UI.
- Uploads multipart et téléchargements blob dans l'adapter.
- Jetons : cookie `HttpOnly` de préférence ; jamais dans `localStorage`.

**Formulaires**
- React Hook Form + Zod. Schéma d'abord, type par `z.infer<>`.
- Erreurs de validation du backend mappées sur les champs dans l'adapter ou l'action.

**UI**
- Tailwind uniquement dans le JSX ; pas de style inline ; pas de CSS modules sauf existant.
- Classes conditionnelles par `cn()` (clsx + tailwind-merge) ; variantes par `class-variance-authority`.
- Mobile-first : base → `md:` → `lg:`.
- Réutilise `components/ui/` (shadcn) avant de créer ; jetons sémantiques du design system.
- **Maquette fournie = contrat** : ordre des blocs, conteneurs, fonds, espacements, rayons, ombres et typographie à l'identique. Un écart se demande avant, il ne se déclare pas après.

**i18n et accessibilité**
- Aucun texte en dur ; clés dans toutes les langues du projet.
- HTML sémantique, libellés, rôles ARIA (ceux de Radix ne se cassent pas), navigation clavier, focus visible, contrastes AA, texte alternatif sur toute image porteuse de sens.

**Données**
- Pas de `useEffect` pour charger des données (thunk au montage ou sur événement, Server Component, ou React Query).
- Droits côté front (route protégée, bouton masqué) = confort UX ; le backend refuse seul.

## Checklist avant de valider

- [ ] Fichiers dans la bonne couche, comme le module voisin ?
- [ ] Aucun appel HTTP hors du fournisseur central et des adapters ?
- [ ] Réponses validées par Zod, conversion de casse dans l'adapter ?
- [ ] Aucun texte en dur, accessibilité traitée ?
- [ ] Logique testée avec un gateway fake (Vitest) ; lint, typecheck et build lancés ?
