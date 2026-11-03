import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Header, Headers, HttpCode, HttpException, Inject, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { DATABASE_POOL } from '../../../../health.controller';
import { authenticateUser } from '../../../identity/infrastructure/http/session.controller';

const phone = z.string().trim().min(6).max(25).regex(/^\+?[0-9 ()-]+$/).refine(value => { const count = value.replace(/\D/g, '').length; return count >= 6 && count <= 15; });
const profile = z.object({ name: z.string().trim().min(1).max(160).optional(), phone: phone.optional(), city: z.string().trim().min(1).max(100).optional() }).strict().refine(value => Object.keys(value).length > 0);
function versionHeader(value: string | undefined): number {
  const match = value?.match(/^"([1-9][0-9]{0,8})"$/);
  if (!match) throw new BadRequestException();
  return Number(match[1]);
}
@ApiTags('agencies')
@ApiBearerAuth()
@Controller('agencies/:agencyId')
export class OnboardingController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'If-Match', required: true, description: 'Version entre guillemets, par exemple "1".' })
  @ApiBody({ schema: { type: 'object', properties: { name: { type: 'string', maxLength: 160 }, phone: { type: 'string', maxLength: 25 }, city: { type: 'string', maxLength: 100 } } } })
  @ApiOkResponse({ description: 'Brouillon mis à jour.', schema: { type: 'object', required: ['id', 'status', 'version'], properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['draft'] }, version: { type: 'integer' } } } })
  async update(@Headers('authorization') auth: string | undefined, @Param('agencyId') agencyId: string, @Headers('if-match') match: string | undefined, @Body() body: unknown): Promise<{ id: string; status: string; version: number }> {
    const user = await authenticateUser(this.pool, auth);
    const input = profile.safeParse(body);
    if (!z.string().uuid().safeParse(agencyId).success || !input.success) throw new BadRequestException();
    const version = versionHeader(match);
    return this.modify(user.id, agencyId, version, input.data, false);
  }

  @Post('submit')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'If-Match', required: true, description: 'Version entre guillemets, par exemple "2".' })
  @ApiOkResponse({ description: 'Dossier soumis pour examen ; aucune approbation automatique.', schema: { type: 'object', required: ['id', 'status', 'version'], properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['submitted'] }, version: { type: 'integer' } } } })
  async submit(@Headers('authorization') auth: string | undefined, @Param('agencyId') agencyId: string, @Headers('if-match') match: string | undefined): Promise<{ id: string; status: string; version: number }> {
    const user = await authenticateUser(this.pool, auth);
    if (!z.string().uuid().safeParse(agencyId).success) throw new BadRequestException();
    return this.modify(user.id, agencyId, versionHeader(match), {}, true);
  }

  private async modify(userId: string, agencyId: string, expected: number, input: { name?: string; phone?: string; city?: string }, submit: boolean): Promise<{ id: string; status: string; version: number }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Membership mutations also lock the agency first; re-check access after acquiring it.
      await client.query('SELECT id FROM agencies WHERE id = $1 FOR UPDATE', [agencyId]);
      const result = await client.query<{ id: string; name: string | null; phone: string | null; city: string | null; status: string; version: number; role: string }>(
        'SELECT a.id, a.name, a.phone, a.city, a.status, a.version, m.role FROM agencies a JOIN agency_memberships m ON m.agency_id = a.id WHERE a.id = $1 AND m.user_id = $2 AND m.active = true', [agencyId, userId],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException();
      if (!['owner', 'admin'].includes(row.role)) throw new ForbiddenException();
      if (row.version !== expected) throw new HttpException('Version mismatch', 412);
      if (row.status !== 'draft') throw new ConflictException();
      const name = input.name ?? row.name;
      const phoneValue = input.phone ?? row.phone;
      const city = input.city ?? row.city;
      if (submit && (!name || !phoneValue || !city)) throw new ConflictException();
      const updated = await client.query<{ id: string; status: string; version: number }>(
        'UPDATE agencies SET name = $1, phone = $2, city = $3, status = $4, version = version + 1 WHERE id = $5 RETURNING id, status, version', [name, phoneValue, city, submit ? 'submitted' : 'draft', agencyId],
      );
      await client.query('INSERT INTO identity_audit (id, user_id, action, agency_id) VALUES ($1, $2, $3, $4)', [randomUUID(), userId, submit ? 'agency.submitted' : 'agency.profile_updated', agencyId]);
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
