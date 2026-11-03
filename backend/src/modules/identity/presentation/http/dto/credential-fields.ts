import { z } from 'zod';

export const emailField = z.string().trim().email().max(254).transform(value => value.toLowerCase());

/** Argon2 input stays bounded in characters and in bytes. */
export const passwordField = (min: number) => z.string().min(min).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 256);
