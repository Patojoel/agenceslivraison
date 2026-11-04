export interface AddServiceZoneCommand {
  readonly actorId: string;
  readonly agencyId: string;
  readonly city: string;
  readonly district: string | null;
}
