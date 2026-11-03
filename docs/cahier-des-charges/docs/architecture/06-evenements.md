# Catalogue initial d'événements métier

| Événement passé | Producteur | Consommateur possible | Timing |
|---|---|---|---|
| AgencyRegistered | agencies | admin | post-commit |
| AgencyCapabilityEnabled | agencies | marketplace projection | post-commit |
| ServiceRequestSubmitted | marketplace | agence destinataire | post-commit, pas de notification externe |
| ServiceRequestAccepted | marketplace | orders orchestration | post-commit idempotent |
| OrderCreated | orders | tracking projection | post-commit |
| ParcelReceived | parcels | inventory / tracking | post-commit |
| DeliveryTaskAssigned | dispatch | tracking projection | post-commit |
| DeliveryCompleted | dispatch | orders / tracking | post-commit |
| StockReserved | inventory | fulfillment | post-commit |
| StockReleased | inventory | fulfillment | post-commit |
| TransferDispatched | transfers | tracking | post-commit |
| TransferReceived | transfers | inventory / tracking | post-commit |

**Ne pas construire de broker dès le départ.** Le catalogue est une cible ; implémenter uniquement les événements nécessaires au lot courant. Envelope : eventId, eventType, schemaVersion, occurredAt, actorId, agencyId éventuel, aggregateId, correlationId, payload minimal ; consommateurs idempotents. Les effets métiers strictement atomiques doivent être traités dans une même transaction locale ou par réservation cohérente, pas laissés à une notification post-commit.
