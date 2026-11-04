/** No data of the agency travels with the action: the agency and the actor are all it needs. */
export interface SubmitAgencyCommand {
  readonly actorId: string;
  readonly agencyId: string;
}
