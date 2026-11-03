# Architecture cible

```text
apps/api (NestJS REST v1)
  src/shared/{domain,application,infrastructure}
  src/modules/{identity,agencies,marketplace,customers,merchants,orders,parcels,
               couriers,dispatch,warehouses,inventory,fulfillment,transfers,
               tracking,pricing,returns,claims,admin,reporting}/
    domain/{model,vo,repositories,exceptions,events}
    application/{command,queries,ports,subscribers}
    infrastructure/{persistence,http,adapters}
    <module>.module.ts
  test/{unit,integration,e2e}
infra/docker/
docs/
```

## Flux
HTTP controller mince → validation Zod → Request/Command → TransactionalCommandHandler → domaine pur → repository Drizzle → commit → événement d'intégration via outbox si nécessaire → DTO HTTP. Queries SQL paramétrées séparées ; jamais de domaine dépendant de NestJS/Drizzle.

## Contextes bornés
- **Identity** : comptes, sessions, memberships, rôles.
- **Agencies** : organisation, capacités, collaborateurs, sites, vérification.
- **Marketplace** : recherche publique, fiches, demandes initiales.
- **Merchants/Customers** : propriétaires de stock, contacts, clients agence.
- **Orders/Parcels** : demande acceptée, commande logistique, unités transportées.
- **Dispatch/Couriers** : affectations, tournées simples, exécution mobile.
- **Warehouses/Inventory/Fulfillment** : réception, stock, réservation, picking.
- **Transfers** : garde du colis et chaîne de responsabilité entre agences.
- **Tracking** : journal append-only d'événements de suivi et projections.
- **Pricing** : tarifs et snapshots de devis.
- **Returns/Claims** : échecs, retours et litiges.
- **Admin/Reporting** : contrôle plateforme, statistiques agrégées.

## Invariants transverses
Un handler écrit un agrégat principal par transaction ; les opérations multi-agrégats utilisent une orchestration explicite, transaction locale quand les invariants exigent l'atomicité, ou événement avec reprise/idempotence. Ne jamais promettre une cohérence atomique distribuée entre agences.

## Réserves
Ne pas créer Redis, BullMQ, broker, websocket ou event sourcing par anticipation. Les introduire seulement si une fonctionnalité approuvée l'exige. L'outbox PostgreSQL peut être relayée par un worker léger si besoin réel.
