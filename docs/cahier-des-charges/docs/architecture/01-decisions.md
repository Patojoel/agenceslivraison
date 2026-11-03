# ADR et périmètre

| ID | Décision | Statut | Conséquence |
|---|---|---|---|
| ADR-01 | Monolithe modulaire NestJS | RECOMMANDÉ | Déploiement et transactions simples ; extraction ultérieure possible |
| ADR-02 | PostgreSQL + Drizzle | RECOMMANDÉ | Migrations explicites, SQL contrôlé |
| ADR-03 | Multi-tenant partagé avec `agency_id` | RECOMMANDÉ | Filtrage obligatoire et défense en profondeur RLS évaluée après tests |
| ADR-04 | Agences livraison / stockage / hybrides | CONFIRMÉ | Capacités activables séparément ; flux métier séparés |
| ADR-05 | Paiement direct à l'agence, sans commission | CONFIRMÉ | Aucun gateway de collecte dans MVP |
| ADR-06 | Notifications, messagerie et paiements plus tard | CONFIRMÉ | Ne pas intégrer de fournisseurs maintenant |
| ADR-07 | Docker dès le début | CONFIRMÉ | Dev/test/prod documentés ; app et DB séparées |
| ADR-08 | Mobile livreur + commerçant | CONFIRMÉ | API compatible clients mobiles, scopes spécifiques |
| ADR-09 | Événements intra-module synchrones ; outbox inter-domaines si nécessaire | RECOMMANDÉ | Éviter RabbitMQ/Redis prématurés |
| ADR-10 | Ressources publiques séparées des données privées agence | RECOMMANDÉ | Projection publique explicitement autorisée |

## Points à valider avant certains modules
- Critères exacts de certification d'agence, responsables de validation et expiration.
- Politique d'acceptation automatique/manuelle des demandes.
- Barèmes de tarifs, dimensions/poids et taxes applicables.
- Preuves de livraison acceptées et politique de conservation.
- Politique de retours, colis perdus, litiges, SLA et responsabilité inter-agences.
- Quotas et fonctionnalités des abonnements (reporter leur facturation).
- Attribution et validation des comptes livreurs ; visibilité de la géolocalisation.
