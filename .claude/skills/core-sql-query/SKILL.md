---
name: core-sql-query
description: Conventions des lectures (QueryHandlers) et de la performance SQL PostgreSQL pour tous les backends (Spring Boot, NestJS, Laravel, FastAPI). Charge ce skill avant d'écrire ou d'optimiser une query, une liste paginée, un tableau de bord ou une statistique côté backend, et pour auditer une requête lente. Impose paramètres nommés, CTE filtrées par tenant dès l'entrée, DTO immuables, test E2E d'abord, et un rapport d'analyse avec vérification réelle des index (pg_indexes, EXPLAIN ANALYZE) suivie d'une migration d'index.
---

# SQL & performance en lecture

**Priorité** : la « Fiche projet » de `CLAUDE.md` donne la clé de tenant, le conteneur de la base locale et l'outil de migration. Utilise-les.

## Où et comment

Les lectures vivent dans `application/queries/<CasUsage>/` : un QueryHandler, une Response, des DTO **immuables**. Le SQL est écrit à la main, paramétré, sans entité ORM en sortie.

| Stack | API à utiliser | Interdit |
| --- | --- | --- |
| Spring Boot | `NamedParameterJdbcTemplate` + `MapSqlParameterSource` (`:param`) | `JdbcTemplate` positionnel, JPQL, méthodes dérivées, entité JPA en sortie |
| NestJS + Drizzle | `` db.execute(sql`... ${valeur}`) `` | concaténation de chaînes, `sql.raw` sur une entrée |
| Laravel | `DB::select($sql, ['param' => $valeur])` | interpolation `"... $var"` |
| FastAPI + SQLAlchemy | `session.execute(text("... :param"), {...})` | f-string dans le SQL |

Les listes passent en paramètre (`IN (:ids)`, `= ANY(:ids)`). Lecture pure : aucune écriture ni effet de bord.

## Règles de performance

1. **CTE filtrées dès l'entrée** sur la clé de tenant et les paramètres de la requête. Jamais un scan global filtré plus tard.
2. **Projection minimale** — pas de `SELECT *`.
3. **Index** — toute colonne de `WHERE`, `JOIN`, `ORDER BY` sur une table volumineuse s'appuie sur un index ; index composite ordonné selon le préfixe le plus à gauche réellement utilisé (souvent `(tenant_id, …)`).
4. **Pas de N+1 ni d'agrégation en mémoire en O(n²)** — agrège en SQL (`json_agg`, `array_agg`, `DISTINCT ON`, fenêtres).
5. **Sargabilité** — pas de fonction sur une colonne indexée dans le `WHERE` (`lower(col)`, `col::date`) sans index d'expression correspondant.
6. **Pagination** sur toute liste potentiellement grande ; par curseur (`WHERE (created_at, id) < (:c, :id)`) au-delà de quelques milliers de lignes.
7. **Aucune donnée codée en dur** (identifiant de rôle, libellé, statut magique) dans le SQL : en paramètre.

## Rapport d'analyse (obligatoire, même si tout est déjà corrigé)

1. **Structure** : CTE, jointures, filtres.
2. **Problèmes** : scans globaux, agrégation en mémoire, données en dur, écarts avec les conventions du projet.
3. **Index vérifiés sur la vraie base**, jamais estimés :
   ```bash
   docker exec <conteneur-bd> psql -U <user> -d <base> -c \
     "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN ('t1','t2');"
   ```
   Tableau : `table.colonne | index existant (oui/non) | recommandation`. Ajoute `EXPLAIN (ANALYZE, BUFFERS)` sur un jeu de données réaliste quand c'est possible.
4. **Récapitulatif priorisé** : 🔴 critique / 🟡 important / 🟠 mineur, avec l'impact attendu.

Index manquant → migration avec l'outil du projet (changeset Liquibase, migration Flyway, Drizzle, Laravel, Alembic), numérotée, et ligne dans l'historique des migrations si le projet en tient un. Si la base est indisponible, dis-le au lieu d'estimer.

## Tests

E2E uniquement, écrit **avant** la query, avec au moins un jeu de données d'un autre tenant qui ne doit jamais apparaître dans le résultat.

## Checklist avant de valider

- [ ] Paramètres nommés, aucune concaténation ?
- [ ] CTE filtrées par tenant à l'entrée, projection minimale, agrégation en SQL ?
- [ ] DTO immuables ?
- [ ] Test E2E écrit d'abord, vert, avec données d'un autre tenant ?
- [ ] Rapport avec `pg_indexes` réellement interrogé + migration d'index si besoin ?
