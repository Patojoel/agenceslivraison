import { BadRequestException, Body, Controller, Header, Get, Headers, HttpCode, Inject, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiBodyOptions, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { sign, verify, JwtPayload } from 'jsonwebtoken';
import { Pool } from 'pg';
import { z } from 'zod';
import { DATABASE_POOL } from '../../../../health.controller';
import { accessKey } from './login.controller';

const inputSchema = z.object({ refreshToken: z.string().max(80).regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/) }).strict();
const tokenBody: ApiBodyOptions = { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string', writeOnly: true } } } };
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

@ApiTags('auth')
@Controller()
export class SessionController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  @Post('auth/refresh')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody(tokenBody)
  @ApiOkResponse({ description: 'Tokens renouvelés ; le jeton précédent est invalidé.', schema: { type: 'object', required: ['accessToken', 'refreshToken', 'expiresIn'], properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, expiresIn: { type: 'number', example: 900 } } } })
  async refresh(@Body() body: unknown): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const [id, secret] = parsed.data.refreshToken.split('.');
    const client = await this.pool.connect();
    try {
      const key = accessKey();
      await client.query('BEGIN');
      const result = await client.query<{ user_id: string; token_digest: string; valid: boolean }>(
        'SELECT user_id, token_digest, (revoked_at IS NULL AND expires_at > now()) AS valid FROM sessions WHERE id = $1 FOR UPDATE', [id],
      );
      const row = result.rows[0];
      if (!row || !row.valid || !timingSafeEqual(Buffer.from(row.token_digest, 'hex'), Buffer.from(hash(secret), 'hex'))) throw new UnauthorizedException();
      const next = randomBytes(32).toString('base64url');
      const token = sign({ sid: id }, key, { algorithm: 'HS256', subject: row.user_id, expiresIn: 900, issuer: 'agenceslivraison', audience: 'agenceslivraison-api' });
      await client.query("UPDATE sessions SET token_digest = $1, version = version + 1, expires_at = now() + interval '30 days' WHERE id = $2", [hash(next), id]);
      await client.query('INSERT INTO identity_audit (id, user_id, action) VALUES ($1, $2, $3)', [randomUUID(), row.user_id, 'session.refresh']);
      await client.query('COMMIT');
      return { accessToken: token, refreshToken: `${id}.${next}`, expiresIn: 900 };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  @Post('auth/logout')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody(tokenBody)
  @ApiOkResponse({ description: 'Session révoquée.' })
  async logout(@Body() body: unknown): Promise<{ success: true }> {
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const [id, secret] = parsed.data.refreshToken.split('.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ user_id: string }>(
        'UPDATE sessions SET revoked_at = now(), version = version + 1 WHERE id = $1 AND token_digest = $2 AND revoked_at IS NULL RETURNING user_id', [id, hash(secret)],
      );
      if (!result.rows[0]) throw new UnauthorizedException();
      await client.query('INSERT INTO identity_audit (id, user_id, action) VALUES ($1, $2, $3)', [randomUUID(), result.rows[0].user_id, 'session.logout']);
      await client.query('COMMIT');
      return { success: true };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  @Get('me/agencies')
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiTags('me')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async agencies(@Headers('authorization') authorization: string | undefined, @Query('limit') limitValue?: string, @Query('cursor') cursor?: string): Promise<{ items: { agencyId: string; role: string }[]; nextCursor: string | null; hasMore: boolean }> {
    const user = await authenticateUser(this.pool, authorization);
    const limit = limitValue === undefined ? 20 : Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (cursor !== undefined && !z.string().uuid().safeParse(cursor).success)) throw new BadRequestException();
    const result = await this.pool.query<{ agency_id: string; role: string }>(
      'SELECT agency_id, role FROM agency_memberships WHERE user_id = $1 AND active = true AND ($2::uuid IS NULL OR agency_id > $2::uuid) ORDER BY agency_id LIMIT $3', [user.id, cursor ?? null, limit + 1],
    );
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map(row => ({ agencyId: row.agency_id, role: row.role }));
    return { items, hasMore, nextCursor: hasMore ? items[items.length - 1].agencyId : null };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiTags('me')
  @ApiOkResponse({ schema: { type: 'object', required: ['id', 'email', 'accountType'], properties: { id: { type: 'string', format: 'uuid' }, email: { type: 'string', format: 'email' }, accountType: { type: 'string', enum: ['individual', 'merchant'] } } } })
  async me(@Headers('authorization') authorization?: string): Promise<{ id: string; email: string; accountType: string }> {
    return authenticateUser(this.pool, authorization);
  }
}

/** Verify the signature and current session before authorizing any agency action. */
export async function authenticateUser(pool: Pool, authorization?: string): Promise<{ id: string; email: string; accountType: string }> {
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
    let claims: string | JwtPayload;
    const key = accessKey();
    try { claims = verify(authorization.slice(7), key, { algorithms: ['HS256'], issuer: 'agenceslivraison', audience: 'agenceslivraison-api' }); }
    catch { throw new UnauthorizedException(); }
    if (typeof claims === 'string' || typeof claims.exp !== 'number' || typeof claims.iat !== 'number' || claims.exp <= claims.iat || claims.exp - claims.iat > 900 || typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(claims.sid) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(claims.sub)) throw new UnauthorizedException();
    const result = await pool.query<{ id: string; email: string; account_type: string }>(
      'SELECT users.id, users.email, users.account_type FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.id = $1 AND users.id = $2 AND sessions.revoked_at IS NULL AND sessions.expires_at > now()', [claims.sid, claims.sub],
    );
    if (!result.rows[0]) throw new UnauthorizedException();
    return { id: result.rows[0].id, email: result.rows[0].email, accountType: result.rows[0].account_type };
}
