import { z } from 'zod';

/** Used by refresh and logout: `<session uuid v4>.<43-character base64url secret>`. */
export const refreshTokenRequest = z.object({
  refreshToken: z.string().max(80).regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/),
}).strict();
