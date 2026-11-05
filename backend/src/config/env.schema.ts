import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;
export const PUBLIC_RATE_LIMIT_PER_MINUTE = 60;

const nodeEnv = z.enum(['development', 'test', 'production']).default('development');
const rateLimitFields = {
  /** Requests a minute and per address for a route without a limit of its own. */
  RATE_LIMIT_DEFAULT_PER_MINUTE: z.coerce.number().int().min(1).max(1_000_000).default(DEFAULT_RATE_LIMIT_PER_MINUTE),
  /** Requests a minute and per address for each public route of the marketplace directory. */
  RATE_LIMIT_PUBLIC_PER_MINUTE: z.coerce.number().int().min(1).max(1_000_000).default(PUBLIC_RATE_LIMIT_PER_MINUTE),
};

type RateLimitEnv = { NODE_ENV: 'development' | 'test' | 'production'; RATE_LIMIT_DEFAULT_PER_MINUTE: number; RATE_LIMIT_PUBLIC_PER_MINUTE: number };

/** The limits may be lowered anywhere and raised only outside production (a test run makes thousands of calls from one address). */
function refuseRaisedLimitsInProduction(env: RateLimitEnv, context: z.RefinementCtx): void {
  if (env.NODE_ENV !== 'production') return;
  if (env.RATE_LIMIT_DEFAULT_PER_MINUTE > DEFAULT_RATE_LIMIT_PER_MINUTE) {
    context.addIssue({ code: 'custom', path: ['RATE_LIMIT_DEFAULT_PER_MINUTE'], message: `in production at most ${DEFAULT_RATE_LIMIT_PER_MINUTE}` });
  }
  if (env.RATE_LIMIT_PUBLIC_PER_MINUTE > PUBLIC_RATE_LIMIT_PER_MINUTE) {
    context.addIssue({ code: 'custom', path: ['RATE_LIMIT_PUBLIC_PER_MINUTE'], message: `in production at most ${PUBLIC_RATE_LIMIT_PER_MINUTE}` });
  }
}

/**
 * Validated at boot. The JWT key is deliberately absent: it is read on every use so that a rotated
 * `JWT_SECRET_FILE` is picked up without restart, and a missing key yields 503 instead of a crash.
 */
export const envSchema = z.object({
  NODE_ENV: nodeEnv,
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_FILE: z.string().min(1).optional(),
  ...rateLimitFields,
}).superRefine((env, context) => {
  refuseRaisedLimitsInProduction(env, context);
  if (Boolean(env.DATABASE_URL) === Boolean(env.DATABASE_URL_FILE)) {
    context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'set exactly one of DATABASE_URL or DATABASE_URL_FILE' });
  }
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map(issue => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Variables d'environnement invalides :\n${details}`);
  }
  return result.data;
};

export const resolveDatabaseUrl = (env: Pick<Env, 'DATABASE_URL' | 'DATABASE_URL_FILE'>): string =>
  env.DATABASE_URL_FILE ? readFileSync(env.DATABASE_URL_FILE, 'utf8').trim() : env.DATABASE_URL ?? '';

const rateLimitSchema = z.object({ NODE_ENV: nodeEnv, ...rateLimitFields }).superRefine(refuseRaisedLimitsInProduction);
let publicLimit: number | undefined;

/** Read once, from the process environment, for the decorators of the public routes (which cannot receive the configuration). */
export function publicRateLimitPerMinute(): number {
  publicLimit ??= rateLimitSchema.parse(process.env).RATE_LIMIT_PUBLIC_PER_MINUTE;
  return publicLimit;
}
