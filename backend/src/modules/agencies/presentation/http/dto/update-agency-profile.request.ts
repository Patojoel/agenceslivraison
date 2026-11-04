import { z } from 'zod';

/** Only the shape of the body is guarded here; lengths and normalization are the domain's call. A `null` description clears it. */
export const updateAgencyProfileRequest = z.object({
  tradeName: z.string().optional(),
  description: z.string().nullable().optional(),
}).strict();
