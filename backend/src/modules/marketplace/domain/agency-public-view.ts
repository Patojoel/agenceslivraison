export type PublicCapability = 'delivery' | 'storage';

export interface PublicZone {
  readonly id: string;
  readonly city: string;
  readonly district: string | null;
}

/**
 * What the public profile may be made of, as `agencies` exposes it: only active capabilities, zones and cities of sites.
 * No legal name, phone, e-mail, registration number, address or member ever reaches `marketplace`.
 */
export interface AgencyPublicView {
  readonly submitted: boolean;
  readonly tradeName: string;
  readonly description: string | null;
  readonly capabilities: readonly PublicCapability[];
  readonly zones: readonly PublicZone[];
  readonly siteCities: readonly string[];
}
