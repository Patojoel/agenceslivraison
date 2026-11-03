import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Header, Headers, HttpCode, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { DATABASE_POOL } from '../../../../health.controller';
import { authenticateUser } from './session.controller';
const invitation = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), role: z.enum(['admin', 'agent']) }).strict();
const accept = z.object({ token: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/) }).strict();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
@ApiTags('agency-invitations')
@ApiBearerAuth()
@Controller()
export class InvitationController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  @Post('agencies/:agencyId/invitations')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['email', 'role'], properties: { email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['admin', 'agent'] } } } })
  @ApiCreatedResponse({ schema: { type: 'object', required: ['token', 'expiresAt'], properties: { token: { type: 'string', description: 'À transmettre confidentiellement une seule fois' }, expiresAt: { type: 'string', format: 'date-time' } } } })
  async issue(@Headers('authorization') auth: string | undefined, @Param('agencyId') agencyId: string, @Body() body: unknown): Promise<{ token: string; expiresAt: string }> {
    const user = await authenticateUser(this.pool, auth);
    const input = invitation.safeParse(body);
    if (!z.string().uuid().safeParse(agencyId).success || !input.success) throw new BadRequestException();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM agencies WHERE id = $1 FOR UPDATE', [agencyId]);
      const membership = await client.query<{ role: string }>('SELECT role FROM agency_memberships WHERE agency_id = $1 AND user_id = $2 AND active = true', [agencyId, user.id]);
      const role = membership.rows[0]?.role;
      if (!role) throw new NotFoundException();
      if (role !== 'owner' && !(role === 'admin' && input.data.role === 'agent')) throw new ForbiddenException();
      const id = randomUUID();
      const secret = randomBytes(32).toString('base64url');
      const saved = await client.query<{ expires_at: Date }>("INSERT INTO agency_invitations (id, agency_id, email, role, token_digest, created_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6, now() + interval '7 days') RETURNING expires_at", [id, agencyId, input.data.email, input.data.role, sha(secret), user.id]);
      await client.query('INSERT INTO identity_audit (id, user_id, action, agency_id) VALUES ($1, $2, $3, $4)', [randomUUID(), user.id, 'invitation.created', agencyId]);
      await client.query('COMMIT');
      return { token: `${id}.${secret}`, expiresAt: saved.rows[0].expires_at.toISOString() };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  @Post('agency-invitations/accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['token'], properties: { token: { type: 'string', writeOnly: true } } } })
  @ApiOkResponse({ schema: { type: 'object', required: ['agencyId', 'role'], properties: { agencyId: { type: 'string', format: 'uuid' }, role: { type: 'string', enum: ['admin', 'agent'] } } } })
  async accept(@Headers('authorization') auth: string | undefined, @Body() body: unknown): Promise<{ agencyId: string; role: string }> {
    const user = await authenticateUser(this.pool, auth);
    const input = accept.safeParse(body);
    if (!input.success) throw new BadRequestException();
    const [id, secret] = input.data.token.split('.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ agency_id: string; role: string }>(
        'SELECT agency_id, role FROM agency_invitations WHERE id = $1 AND token_digest = $2 AND email = $3 AND accepted_at IS NULL AND expires_at > now() FOR UPDATE', [id, sha(secret), user.email],
      );
      const item = result.rows[0];
      if (!item) throw new NotFoundException();
      await client.query('SELECT id FROM agencies WHERE id = $1 FOR UPDATE', [item.agency_id]);
      const inserted = await client.query('INSERT INTO agency_memberships (id, agency_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT (agency_id, user_id) DO NOTHING', [randomUUID(), item.agency_id, user.id, item.role]);
      if (inserted.rowCount !== 1) throw new ConflictException();
      await client.query('UPDATE agency_invitations SET accepted_at = now() WHERE id = $1', [id]);
      await client.query('INSERT INTO identity_audit (id, user_id, action, agency_id, subject_user_id) VALUES ($1, $2, $3, $4, $2)', [randomUUID(), user.id, 'invitation.accepted', item.agency_id]);
      await client.query('COMMIT');
      return { agencyId: item.agency_id, role: item.role };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
