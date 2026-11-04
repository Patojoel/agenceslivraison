export interface CreateAgencyCommand {
  readonly actorId: string;
  readonly tradeName: string;
  readonly idempotencyKey: string | null;
}
