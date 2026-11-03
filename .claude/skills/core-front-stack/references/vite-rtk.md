# Référence — React + Vite + Redux Toolkit (hexagonal)

## Structure d'une feature (défaut)

```
src/<feature>/
├── models/          # types de domaine purs (aucune dépendance framework)
├── gateway/         # interface TypeScript = port (contrat uniquement)
├── usecases/        # triplets <CasUsage>Command / <CasUsage>Response / <CasUsage>Async (createAppAsyncThunk)
├── slices/          # <Feature>Slice.ts + <Feature>Selectors.ts
├── listeners/       # middleware listener RTK pour les effets de bord
└── infra/
    ├── repo/        # Http<Feature>Gateway extends HttpProvider = adapter
    ├── routes/      # définitions React Router
    ├── ui/          # composants + hooks use*
    └── validation/  # schémas Zod
```

Variante rencontrée : port dans `models/gateway/`, routes d'API dans `infra/api-routes/`, validateurs dans `infra/validators/`. Suis la variante du dépôt.

## Règles

- Le domaine (`models/`, `gateway/`, `usecases/`) n'importe jamais `infra/` ni l'UI.
- Les adapters implémentent l'interface du gateway et sont **injectés** via `config/extraArgument.ts` (ou le conteneur de dépendances du projet). Jamais d'import d'un `Http*Gateway` dans un thunk, un slice ou un composant.
- Le thunk déstructure `{ extra: { <gateway> }, rejectWithValue }` et passe par le middleware d'appel du projet s'il existe.
- L'UI dispatche des thunks et lit des sélecteurs ; elle n'appelle jamais HTTP.
- Hooks typés uniquement : `useAppDispatch` / `useAppSelector` depuis `config/hooks.ts`.
- Sélecteurs dans `XxxSelectors.ts`, jamais inline dans un composant ; `createEntityAdapter` + `currentId` pour les collections.
- Effets de bord dans `listeners/`, pas dans un `useEffect`.
- Nouveau slice ajouté au reducer racine ; exclu de la persistance (`redux-persist` blacklist) si l'état ne doit pas survivre au rafraîchissement ; actions sérialisables.
- Transversal : modales via `ModalEvents.open/close(ModalEventKey.X)`, toasts via `Notify.success/error()`.
- i18n : `react-i18next` (ou `react-intl` selon le projet), fichiers sous `assets/`.

## Tests

`createTestStore({ <gateway>: fake })` avec un fake in-memory. On teste thunk + slice + sélecteurs ensemble sur un comportement.

## Validation

`npm run test -- --run`, `npm run lint`, `npm run build` (inclut `tsc -b`).
