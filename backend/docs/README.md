# Documentation API pour les clients

Cette documentation aide à développer les interfaces `front-office`, `admin-back-office-agence`, `admin-platform` et, plus tard, les applications mobiles. Elle décrit l'état du code dans ce dépôt ; vérifier la version déployée avant toute intégration.

| Groupe | Statut | Documentation |
| --- | --- | --- |
| Santé et disponibilité | Implémenté | [Santé](routes/sante.md) |
| Identité et accès | Inscription, sessions et accès agence disponibles ; onboarding prévu | [Identité et accès](routes/identite-acces.md) |
| Agences | Création de brouillon disponible | [Agences](routes/agences.md) |
| Marketplace | Prévu | [Groupes métier prévus](routes/groupes-prevus.md) |
| Commandes, livraison et suivi | Prévu | [Groupes métier prévus](routes/groupes-prevus.md) |
| Stockage, transferts et retours | Prévu | [Groupes métier prévus](routes/groupes-prevus.md) |
| Administration et rapports | Prévu | [Groupes métier prévus](routes/groupes-prevus.md) |

Lire les [conventions d'intégration](conventions.md) avant de développer un client. L'OpenAPI de l'instance, généré depuis le code, est consultable sous `/api/v1/docs` et en JSON sous `/api/v1/docs-json`. Il reflète les routes enregistrées mais certains schémas de réponse peuvent encore manquer. Mettre cette documentation et les tests à jour avec chaque nouvelle route ou modification de contrat.
