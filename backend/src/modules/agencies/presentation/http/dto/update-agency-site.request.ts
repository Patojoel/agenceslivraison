import { z } from 'zod';

/** A partial change: what is left out stays as it is, and a null phone clears it. */
export const updateAgencySiteRequest = z.object({
  name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
}).strict();
