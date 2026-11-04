# Événements de domaine

Tous les événements actuels sont des **événements de domaine synchrones**. Après la sauvegarde de l'agrégat, le handler les publie via `DomainEventPublisher`. `InProcessDomainEventPublisher` les transmet aux subscribers dans la transaction de la commande : un échec du subscriber annule toute la commande. Aucun événement d'intégration ni outbox n'existe encore.

Le seul consommateur aujourd'hui est l'audit. `IdentityAuditSubscriber` et `AgencyAuditSubscriber` écrivent chacun une ligne dans `identity_audit` par événement. `occurred_at` prend l'heure de la base.

| Événement | Émetteur | Charge utile | Ligne d'audit (`action` · `user_id` · `agency_id` · `subject_user_id`) |
| --- | --- | --- | --- |
| `UserRegistered` | `User.register` | `userId` | `user.registered` · userId · — · — |
| `SessionOpened` | `Session.open` (connexion) | `userId`, `sessionId` | `session.login` · userId · — · — |
| `SessionRefreshed` | `Session.rotate` | `userId`, `sessionId` | `session.refresh` · userId · — · — |
| `SessionRevoked` | `Session.revoke` (déconnexion) | `userId`, `sessionId` | `session.logout` · userId · — · — |
| `AgencyRegistered` | `Agency.draft` (création d'une agence) | `agencyId`, `actorId` | `agency.created` · actorId · agencyId · — |
| `AgencyIdentityUpdated` | `Agency.completeIdentity` (seulement si un champ change réellement) | `agencyId`, `actorId`, `fields` (noms des champs modifiés, jamais leurs valeurs) | `agency.identity_updated` · actorId · agencyId · — · `details = { "fields": [...] }` |
| `AgencyProfileUpdated` | `Agency.updateProfile` (seulement si un champ change réellement) | `agencyId`, `actorId`, `fields` (`tradeName`, `description`) | `agency.profile_updated` · actorId · agencyId · — · `details = { "fields": [...] }` |
| `InvitationIssued` | `Invitation.issue` | `agencyId`, `actorId` | `invitation.created` · actorId · agencyId · — |
| `InvitationAccepted` | `Invitation.accept` | `agencyId`, `userId` | `invitation.accepted` · userId · agencyId · userId |
| `MembershipRoleChanged` | `AgencyTeam.changeRole` | `agencyId`, `actorId`, `subjectUserId` | `membership.role_changed` · actorId · agencyId · subjectUserId |
| `MembershipRevoked` | `AgencyTeam.revoke` | `agencyId`, `actorId`, `subjectUserId` | `membership.removed` · actorId · agencyId · subjectUserId |

La colonne `details` (jsonb, nullable) de `identity_audit` ne porte que des métadonnées sûres : aujourd'hui les **noms** des champs modifiés (`AuditDetails.fields`), jamais ce qu'une personne a saisi. Les champs d'identité (téléphone, adresse, RCCM, NIU…) sont des données personnelles ou sensibles : ne jamais les mettre dans un événement ni dans l'audit. Une demande qui ne change rien n'émet aucun événement et n'écrit aucune ligne.

Pour ajouter un événement : déclarer son type dans l'union du module (`identity-events.ts` ou `agency-events.ts`), l'enregistrer depuis l'agrégat, puis compléter le subscriber et ce tableau. Un futur consommateur dans un autre module, ou toute réaction qui doit survivre à un échec, devra passer par un événement d'intégration publié après commit, avec un consommateur idempotent.
