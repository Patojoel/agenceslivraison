# Référence — Laravel (PHP 8.2+)

## Arborescence d'un domaine

```
app/
├── Domain/<Domaine>/
│   ├── Model/            # agrégats PHP purs (pas d'Eloquent)
│   ├── ValueObject/
│   ├── Repository/       # interfaces
│   ├── Exception/
│   └── Event/
├── Application/<Domaine>/
│   ├── Command/<CasUsage>/   # Command, Handler, Response (final readonly class)
│   ├── Query/<CasUsage>/     # QueryHandler, Response, DTO
│   ├── Subscriber/
│   └── Port/
└── Infrastructure/<Domaine>/
    ├── Persistence/      # modèles Eloquent (persistance uniquement), Eloquent<Agg>Repository, mapper
    ├── Adapter/<Fournisseur>/
    ├── Http/             # contrôleurs invocables, FormRequest, fabrique Request → Command
    └── Provider/<Domaine>ServiceProvider.php   # bindings interface → implémentation
```

## Règles propres à Laravel

- Eloquent n'est qu'un détail de persistance : un modèle Eloquent ne sort jamais de `Infrastructure/`.
- Transaction : décorateur `TransactionalCommandHandler` autour de `DB::transaction()`.
- Événements d'intégration : jobs en file dispatchés **après commit** (`afterCommit`), idempotents.
- Erreurs de validation au format Laravel `{ errors: { champ: string[] } }` ; 419 = CSRF expiré, 422 = validation.
- Auth SPA : Sanctum en cookie, appel à `/sanctum/csrf-cookie` avant le login.

## Queries

`DB::select($sql, ['tenantId' => $tenantId])` avec liaisons nommées. Jamais d'interpolation de variable dans le SQL. Voir `core-sql-query`.

## Tests

| Niveau | Outils |
| --- | --- |
| Unit | Pest ou PHPUnit, handler instancié à la main, repositories in-memory |
| Feature | `RefreshDatabase` sur une vraie base PostgreSQL ou MySQL |
| E2E | tests HTTP (`$this->postJson(...)`) sur l'application complète |
