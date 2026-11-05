/**
 * What an agency says of itself to the modules that build its public side: the trade name and description, whether it
 * was submitted, and only what is active now (capabilities, served zones, cities of the sites). Never the legal name, the
 * phone, the e-mail, the registration numbers, an address, the team or a suspension reason.
 */
export interface AgencyPublicView {
  readonly submitted: boolean;
  readonly tradeName: string;
  readonly description: string | null;
  readonly capabilities: readonly ('delivery' | 'storage')[];
  readonly zones: readonly { readonly id: string; readonly city: string; readonly district: string | null }[];
  readonly siteCities: readonly string[];
}
