import { z } from 'zod';

const MAX_TEXT = 400;
const MAX_CURSOR = 4096;

/**
 * The query string of the public directory, the closed list of what a visitor may send (UC-03-02, UC-03-03): any other key is
 * refused, a repeated key is refused except `capability` (at most twice: delivery and storage). The shape only is checked
 * here; the bounds, the characters and the meaning are those of `PublicSearchCriteria`.
 */
export const publicSearchQuery = z.object({
  q: z.string().max(MAX_TEXT).optional(),
  city: z.string().max(MAX_TEXT).optional(),
  district: z.string().max(MAX_TEXT).optional(),
  capability: z.union([z.string().max(20), z.array(z.string().max(20)).max(2)]).optional(),
  limit: z.string().regex(/^[0-9]{1,2}$/).transform(Number).optional(),
  cursor: z.string().max(MAX_CURSOR).optional(),
}).strict();

export type PublicSearchQuery = z.output<typeof publicSearchQuery>;
