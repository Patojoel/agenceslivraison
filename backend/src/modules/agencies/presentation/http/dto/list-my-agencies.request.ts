import { z } from 'zod';

/** Query string `limit`: 20 when absent, otherwise an integer from 1 to 100. */
export const limitParam = z.union([
  z.undefined().transform(() => 20),
  z.string().transform(Number).pipe(z.number().int().min(1).max(100)),
]);

export const cursorParam = z.union([z.undefined().transform(() => null), z.string().uuid()]);
