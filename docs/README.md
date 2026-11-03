# Documentation du projet

| Dossier ou fichier | Contenu |
|---|---|
| [cahier-des-charges/](cahier-des-charges/) | Cahier des charges du backend, en lecture seule : décisions, architecture cible, roadmap des lots, critères d'acceptation, fiches des 16 modules. Commencer par `README.md` puis `CODEX.md`. |
| [architecture/architecture-backend.md](architecture/architecture-backend.md) | Structure de référence des modules backend, conventions de nommage, règles de couches et écarts assumés avec l'exemple de référence. |
| [architecture/adr-001-typeorm-et-architecture-normalisee.md](architecture/adr-001-typeorm-et-architecture-normalisee.md) | Décision D-01 : passage de Drizzle à TypeORM et architecture normalisée (contexte, options, conséquences, vérification). |
| `use-cases/` | Produit par l'agent `use-case-writer` à l'étape S1 de chaque lot (pas encore créé). |

Ailleurs dans le dépôt :

- [`progress.md`](../progress.md) et [`phases.md`](../phases.md) : avancement et découpage des phases.
- [`CLAUDE.md`](../CLAUDE.md) et `.claude/` : fiche projet, mode de travail, agents et skills Claude Code.
- [`backend/docs/`](../backend/docs/) : documentation du code livré (domaines, événements, routes pour les clients web et mobiles, exploitation).
