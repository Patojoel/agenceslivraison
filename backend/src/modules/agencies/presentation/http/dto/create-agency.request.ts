import { z } from 'zod';

/** Length and trimming are the domain's call (`TradeName`); this only guards the shape of the body. */
export const createAgencyRequest = z.object({ tradeName: z.string() }).strict();
