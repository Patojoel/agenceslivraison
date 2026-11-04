export interface EnableCapabilityCommand {
  readonly actorId: string;
  readonly agencyId: string;
  /** "delivery" or "storage"; anything else is refused. */
  readonly capability: string;
}
