import { z } from 'zod';

/** The whole spelling of the zone, as when adding one; lengths and normalization are the domain's call. */
export const correctServiceZoneRequest = z.object({
  city: z.string(),
  district: z.string().nullable().optional(),
}).strict();
