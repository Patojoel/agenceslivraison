import { z } from 'zod';

/** Publishing and withdrawing take no body: the agency is the path, the author the session. Anything else is a 400. */
export const noBody = z.object({}).strict().optional();
