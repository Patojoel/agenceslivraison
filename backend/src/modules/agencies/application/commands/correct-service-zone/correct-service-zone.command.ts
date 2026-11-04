export interface CorrectServiceZoneCommand {
  readonly actorId: string;
  readonly agencyId: string;
  readonly zoneId: string;
  /** The whole spelling of the zone: what is sent replaces what is stored. */
  readonly city: string;
  readonly district: string | null;
}
