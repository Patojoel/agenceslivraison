import { BadRequestException, Body, Controller, Header, HttpCode, Inject, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sign } from 'jsonwebtoken';
import { Pool } from 'pg';
import { z } from 'zod';
import { DATABASE_POOL } from '../../../../shared/infrastructure/db/create-pool';

const dummyHash = '$argon2id$v=19$m=19456,t=2,p=1$sDbt/mYsiVrBeP80Np+K5g$PAxLDo8DSXHkzA4CN0JJy5WUpK1BOVUSQxeCrevR2+k';
const inputSchema = z.object({ email: z.string().trim().email().max(254).transform(value => value.toLowerCase()), password: z.string().min(1).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 256) }).strict();
export function accessKey(): string {
  const file = process.env.JWT_SECRET_FILE;
  if (file && process.env.JWT_SECRET) throw new ServiceUnavailableException('Authentication unavailable');
  let key: string | undefined;
  try { key = file ? readFileSync(file, 'utf8').trim() : process.env.JWT_SECRET; } catch { throw new ServiceUnavailableException('Authentication unavailable'); }
  if (!key || Buffer.byteLength(key, 'utf8') < 32) throw new ServiceUnavailableException('Authentication unavailable');
  return key;
}

@ApiTags('auth')
@Controller('auth')
export class LoginController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  @Post('login')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', writeOnly: true } } } })
  @ApiOkResponse({ schema: { type: 'object', required: ['accessToken', 'refreshToken', 'expiresIn'], properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'number', example: 900 } } } })
  async login(@Body() body: unknown): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const key = accessKey();
    const result = await this.pool.query<{ id: string; password_hash: string | null }>('SELECT id, password_hash FROM users WHERE email = $1', [parsed.data.email]);
    const user = result.rows[0];
    const valid = await argon2.verify(user?.password_hash ?? dummyHash, parsed.data.password);
    if (!user || !user.password_hash || !valid) throw new UnauthorizedException();
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const tokenDigest = createHash('sha256').update(secret).digest('hex');
    const accessToken = sign({ sid: sessionId }, key, { algorithm: 'HS256', subject: user.id, expiresIn: 900, issuer: 'agenceslivraison', audience: 'agenceslivraison-api' });
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("INSERT INTO sessions (id, user_id, token_digest, expires_at) VALUES ($1, $2, $3, now() + interval '30 days')", [sessionId, user.id, tokenDigest]);
      await client.query('INSERT INTO identity_audit (id, user_id, action) VALUES ($1, $2, $3)', [randomUUID(), user.id, 'session.login']);
      await client.query('COMMIT');
      return { accessToken, refreshToken: `${sessionId}.${secret}`, expiresIn: 900 };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
