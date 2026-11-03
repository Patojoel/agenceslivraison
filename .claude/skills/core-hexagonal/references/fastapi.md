# Référence — FastAPI (Python 3.12+)

## Arborescence d'un domaine

```
app/<domaine>/
├── domain/
│   ├── model.py          # agrégats (classes pures)
│   ├── value_objects.py
│   ├── repositories.py   # Protocol ou ABC
│   ├── exceptions.py
│   └── events.py
├── application/
│   ├── commands/<cas_usage>.py   # Command (dataclass gelée), Handler, Response
│   ├── queries/<cas_usage>.py
│   ├── subscribers.py
│   └── ports.py
└── infrastructure/
    ├── persistence/      # modèles SQLAlchemy, SqlAlchemy<Agg>Repository, mapper
    ├── adapters/<fournisseur>.py
    ├── http/             # router.py, schemas.py (Pydantic), fabrique Request → Command
    └── container.py      # fournisseurs de dépendances (Depends)
```

## Règles propres à FastAPI

- Pydantic reste à la frontière HTTP ; le domaine utilise des dataclasses.
- Transaction : Unit of Work en gestionnaire de contexte, ouvert par le décorateur de handler.
- Champs en snake_case côté Python : la conversion en camelCase se fait soit par `alias_generator` Pydantic, soit dans l'adapter du front, jamais dans les composants.
- Erreurs de validation au format Pydantic `{ detail: [{ loc, msg, type }] }`.
- Schéma OpenAPI généré à `/docs` : source de vérité pour typer les gateways du front.

## Queries

`session.execute(text("... WHERE tenant_id = :tenant_id"), {"tenant_id": tenant_id})`. Jamais de f-string dans le SQL. Migrations Alembic. Voir `core-sql-query`.

## Tests

| Niveau | Outils |
| --- | --- |
| Unit | pytest, handler instancié à la main, repositories in-memory |
| Feature | pytest + PostgreSQL réelle (Testcontainers), transaction annulée ou base nettoyée entre tests |
| E2E | `httpx.AsyncClient` sur l'application complète |
