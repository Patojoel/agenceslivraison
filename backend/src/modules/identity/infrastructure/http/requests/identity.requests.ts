import { z } from 'zod';
import { ACCOUNT_TYPES } from '../../../domain/account-type';

const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
const boundedPassword = (min: number) => z.string().min(min).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 256);

export const registerRequest = z.object({ email, password: boundedPassword(12), accountType: z.enum(ACCOUNT_TYPES) }).strict();

export const loginRequest = z.object({ email, password: boundedPassword(1) }).strict();

export const refreshTokenRequest = z.object({
  refreshToken: z.string().max(80).regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/),
}).strict();
