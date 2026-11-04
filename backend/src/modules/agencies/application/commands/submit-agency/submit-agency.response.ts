export interface SubmitAgencyResponse {
  readonly status: 'submitted';
  readonly submission: { readonly submittedAt: string; readonly submittedBy: string };
}
