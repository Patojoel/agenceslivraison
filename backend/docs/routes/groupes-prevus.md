# Groupes métier prévus

Ces préfixes sont issus du cadrage et ne sont pas encore disponibles. Ils servent à organiser la documentation future ; ils ne définissent ni méthodes HTTP, ni champs, ni permissions.

| Domaine | Préfixes indicatifs sous `/api/v1` | Clients concernés à préciser |
| --- | --- | --- |
| Agences et équipes | `/agencies`, `/agency-members`, `/agency-onboarding` | administration agence et plateforme |
| Marketplace | `/public/agencies`, `/service-requests` | front-office et agence |
| Clients et commerçants | `/customers`, `/merchants` | agence et commerçant |
| Tarifs | `/pricing` | à définir |
| Commandes et suivi | `/orders`, `/parcels`, `/tracking` | agence et clients autorisés |
| Livraison | `/couriers`, `/delivery-tasks` | agence et livreur |
| Stockage et préparation | `/warehouses`, `/inventory`, `/stock-reservations`, `/fulfillment` | agence et commerçant autorisé |
| Transferts et incidents | `/transfers`, `/returns`, `/claims` | acteurs autorisés |
| Administration et rapports | `/admin`, `/reports` | administration plateforme ou agence selon permission |

Pour chaque groupe implémenté, créer une fiche séparée avec méthode, chemin, acteur autorisé, paramètres, requête, réponses, erreurs, exemples et statut. Documenter aussi pagination, idempotence et concurrence quand elles s'appliquent. Les données et permissions accessibles à chaque interface doivent être établies par le backend.
