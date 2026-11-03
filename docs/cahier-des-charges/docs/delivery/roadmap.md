# Roadmap de livraison séquentielle — Codex

Chaque lot = plan soumis à validation, code et tests, démonstration HTTP, migration, mise à jour OpenAPI et Docker vérifié.

| Lot | Périmètre | Dépendance | Critère de sortie |
|---|---|---|---|
| 0 | Initialisation NestJS strict, Docker API + DB, migrations, CI, healthchecks, tests | aucune | `docker compose up --build`, health/readiness, test E2E |
| 1 | Identité, sessions, memberships, rôles, tenant | 0 | anti-IDOR, refresh rotation, audit |
| 2 | Onboarding agence, capacités, sites, équipe | 1 | agence brouillon→soumise, validations |
| 3 | Tarifs, zones, profils publics et recherche marketplace | 2 | recherches paginées et projections publiques |
| 4 | Clients, profils commerçants, demandes de services | 3 | demande≠commande, acceptation idempotente |
| 5 | Commandes, colis, journal tracking | 4 | statuts protégés et historique |
| 6 | Livreurs, missions, endpoints mobile livreur | 5 | assignation, tentative, POD, reprise offline |
| 7 | Entrepôts, réception, inventaire, réservations | 5 | stock non négatif en concurrence |
| 8 | Préparation, sorties, transferts inter-agences | 6–7 | preuve de garde et isolement inter-tenant |
| 9 | Retours, incidents, réclamations | 6–8 | chaînes de responsabilité conservées |
| 10 | Dashboard, exports, admin plateforme, durcissement | 1–9 | mesures, audit, performances |
| ultérieur | Notifications, messagerie, paiements, abonnements facturés, intégrations externes | MVP stable | nouvelle décision métier et plan dédié |

**Mobile commerçant** : utiliser dès les lots 4, 5, 7 et 8 des endpoints compatibles avec son périmètre (ses commandes, ses stocks et ses demandes), sans exposition des clients internes d'une agence.

## Interdictions
Pas de faux CRUD qui supprime les commandes/colis/stock ; pas de gateway paiement, WhatsApp ou messagerie anticipé ; pas de microservices prématurés ; pas de fausse démonstration avec données en mémoire présentée comme API persistante.
