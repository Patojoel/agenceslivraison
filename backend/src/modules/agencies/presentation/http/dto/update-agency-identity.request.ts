import { z } from 'zod';

/**
 * Only the shape of the body is guarded here; lengths, formats and normalization are the domain's call.
 * A field left out is unchanged. The three optional fields accept `null` to be cleared.
 */
export const updateAgencyIdentityRequest = z.object({
  legalName: z.string().optional(),
  headquartersCity: z.string().optional(),
  headquartersAddress: z.string().optional(),
  primaryPhone: z.string().optional(),
  contactEmail: z.string().nullable().optional(),
  rccm: z.string().nullable().optional(),
  niu: z.string().nullable().optional(),
}).strict();
