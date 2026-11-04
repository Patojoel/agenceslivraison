export interface SuspendCapabilityCommand {
  readonly actorId: string;
  readonly agencyId: string;
  /** "delivery" or "storage"; anything else is refused. */
  readonly capability: string;
  readonly reason: string;
}
