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
| `AgencySubmittedForVerification` | `Agency.submit` (une seule fois par agence) | `agencyId`, `actorId` | `agency.submitted` · actorId · agencyId · — (aucun `details`, aucune valeur de l'agence) |
| `ServiceZoneAdded` | `Agency.addZone` | `agencyId`, `actorId`, `zoneId`, `reactivated` (vrai si une zone retirée revient) | `agency.zone_added` ou `agency.zone_reactivated` · actorId · agencyId · — · `resource_id = zoneId` |
| `ServiceZoneRenamed` | `Agency.correctZone` (seulement si le libellé change réellement) | `agencyId`, `actorId`, `zoneId`, `fields` (`city`, `district`, jamais les valeurs) | `agency.zone_renamed` · actorId · agencyId · — · `resource_id = zoneId`, `details.fields` |
| `ServiceZoneRetired` | `Agency.retireZone` | `agencyId`, `actorId`, `zoneId` | `agency.zone_retired` · actorId · agencyId · — · `resource_id = zoneId` |
| `AgencySiteCreated` | `Agency.createSite` | `agencyId`, `actorId`, `siteId` | `agency.site_created` · actorId · agencyId · — · `resource_id = siteId` |
| `AgencySiteUpdated` | `Agency.updateSite` (seulement si un champ change réellement) | `agencyId`, `actorId`, `siteId`, `fields` (`name`, `city`, `address`, `phone`) | `agency.site_updated` · actorId · agencyId · — · `resource_id = siteId` · `details = { "fields": [...] }` |
| `AgencySiteDeactivated` | `Agency.deactivateSite` | `agencyId`, `actorId`, `siteId` | `agency.site_deactivated` · actorId · agencyId · — · `resource_id = siteId` |
| `AgencySiteReactivated` | `Agency.reactivateSite` | `agencyId`, `actorId`, `siteId` | `agency.site_reactivated` · actorId · agencyId · — · `resource_id = siteId` |
| `AgencyCapabilityEnabled` | `Agency.enableCapability` (activation ou réactivation) | `agencyId`, `actorId`, `capability` (`delivery` ou `storage`) | `agency.capability_enabled` · actorId · agencyId · — · `details = { "fields": [capability] }` |
| `AgencyCapabilitySuspended` | `Agency.suspendCapability` | `agencyId`, `actorId`, `capability` | `agency.capability_suspended` · actorId · agencyId · — · `details = { "fields": [capability] }` |
| `InvitationIssued` | `Invitation.issue` | `agencyId`, `actorId` | `invitation.created` · actorId · agencyId · — |
| `InvitationAccepted` | `Invitation.accept` | `agencyId`, `userId` | `invitation.accepted` · userId · agencyId · userId |
| `MembershipRoleChanged` | `AgencyTeam.changeRole` | `agencyId`, `actorId`, `subjectUserId` | `membership.role_changed` · actorId · agencyId · subjectUserId |
| `MembershipRevoked` | `AgencyTeam.revoke` | `agencyId`, `actorId`, `subjectUserId` | `membership.removed` · actorId · agencyId · subjectUserId |

La colonne `resource_id` (uuid, nullable, sans clé étrangère : l'audit survit à toute ressource) porte l'identifiant opaque de la ressource touchée (zone, site) ; elle est dédiée plutôt que logée dans `details` parce que c'est un identifiant typé et interrogeable, pas une métadonnée libre. `NULL` pour les actions sans ressource. La colonne `details` (jsonb, nullable) de `identity_audit` ne porte que des métadonnées sûres : aujourd'hui les **noms** des champs modifiés (`AuditDetails.fields`), jamais ce qu'une personne a saisi. Les champs d'identité (téléphone, adresse, RCCM, NIU…) sont des données personnelles ou sensibles : ne jamais les mettre dans un événement ni dans l'audit. Une demande qui ne change rien n'émet aucun événement et n'écrit aucune ligne. Pour la configuration, `details.fields` ne porte que des types de capacité ou des noms de champs : ni ville, ni quartier, ni nom de site, ni adresse, ni téléphone, ni motif de suspension (le motif est conservé dans l'historique des capacités, lisible dans l'état d'onboarding par les membres, pas dans l'audit). `AgencyCapabilityEnabled` et `AgencyCapabilitySuspended` seront consommés par la projection publique du lot 3 ; tant qu'aucun besoin inter-domaines n'est validé, ils restent des événements de domaine in-process.

Pour ajouter un événement : déclarer son type dans l'union du module (`identity-events.ts` ou `agency-events.ts`), l'enregistrer depuis l'agrégat, puis compléter le subscriber et ce tableau. Un futur consommateur dans un autre module, ou toute réaction qui doit survivre à un échec, devra passer par un événement d'intégration publié après commit, avec un consommateur idempotent.
