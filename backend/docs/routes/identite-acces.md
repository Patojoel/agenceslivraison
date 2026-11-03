# Identité et accès — prévu

Aucune route de ce groupe n'est implémentée à ce jour. La fiche de cadrage mentionne les chemins indicatifs suivants :

| Méthode | Chemin indicatif | Intention |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Créer un compte |
| POST | `/api/v1/auth/login` | Se connecter |
| POST | `/api/v1/auth/refresh` | Renouveler une session |
| POST | `/api/v1/auth/logout` | Révoquer une session |
| GET | `/api/v1/me` | Consulter son profil |
| POST | `/api/v1/agencies/{id}/invitations` | Inviter un membre |
| PATCH | `/api/v1/agencies/{id}/members/{memberId}` | Modifier le rôle d'un membre |
| DELETE | `/api/v1/agencies/{id}/members/{memberId}` | Retirer un accès |

Ces chemins peuvent évoluer. Les champs, formats de session, codes d'erreur et autorisations ne sont pas encore définis ; ne pas générer de formulaires ou de clients API en supposant leurs valeurs. Le cadrage prévoit plusieurs agences par utilisateur, une agence active validée côté serveur, la protection du dernier propriétaire et l'interdiction de s'attribuer soi-même un rôle supérieur.
