# Référence — Next.js App Router

## Structure

```
src/
├── middleware.ts                 # protection des routes, réécritures (multi-tenant par hôte), en-têtes
├── app/
│   ├── (public)/                 # pages publiques
│   ├── (dashboard)/              # pages protégées ; loading.tsx et error.tsx à chaque frontière significative
│   └── api/                      # route handlers (proxy de même origine, webhooks internes, revalidation)
├── features/<feature>/
│   ├── actions/                  # Server Actions (mutations) : parse Zod → fournisseur HTTP serveur → mapping des erreurs
│   ├── components/               # Server Components par défaut ; "use client" seulement si interactif
│   ├── hooks/                    # hooks client
│   ├── queries/                  # lectures serveur avec options de cache (tags, revalidate, no-store)
│   ├── validation/               # schémas Zod (le même schéma sert au client et à l'action)
│   └── types/
├── lib/                          # auth, fournisseurs HTTP, formatage, utilitaires
└── components/ui/                # shadcn/ui
```

## Règles

- Server Components par défaut ; `"use client"` uniquement pour l'interactivité, les API navigateur ou les hooks.
- Lectures dans `queries/` avec une stratégie de cache explicite (`force-cache` + tags, `revalidate`, `no-store`). Revalidation par tag après mutation (`revalidateTag`).
- Mutations par Server Actions ; côté client `useActionState` / `useFormStatus`.
- Polling ou cache client : React Query, en appelant un route handler de même origine.
- État global client : Zustand ou React Query ; pas de Redux sauf existant.
- Protection des routes dans `middleware.ts` (Auth.js ou JWT maison) **et** vérification côté serveur dans la page ou l'action.
- `next/image`, `next/link`, `next/font` toujours ; jamais `<img>`, `<a>` interne ni police par CDN.
- Métadonnées par `generateMetadata()` ou export `metadata`.
- Préfixe `NEXT_PUBLIC_` uniquement pour ce qui doit être exposé au navigateur.
- Deux fournisseurs HTTP : un serveur (ajoute le jeton depuis la session) et un navigateur (n'appelle que des route handlers de même origine).
- i18n : `next-intl` (messages par langue).

## Tests

Vitest pour la logique des actions et queries (fournisseur HTTP remplacé par un fake), Testing Library pour les composants client, Playwright pour les parcours.

## Validation

`npm run lint`, `npx tsc --noEmit`, `npm run build`, tests.
