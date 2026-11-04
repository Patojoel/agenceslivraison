import { z } from 'zod';

/** Only the shape of the body is guarded here; lengths and normalization are the domain's call. */
export const addServiceZoneRequest = z.object({
  city: z.string(),
  district: z.string().nullable().optional(),
}).strict();
