import { BadRequestException, Body, ConflictException, Controller, Get, Header, Headers, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { DATABASE_POOL } from '../../../../health.controller';
import { authenticateUser } from '../../../identity/infrastructure/http/session.controller';
import { AgencyInputError, createDraft } from '../../domain/draft';

const inputSchema = z.object({ name: z.string().max(200) }).strict();
@ApiTags('agencies')
@ApiBearerAuth()
@Controller('agencies')
export class AgenciesController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
  @Get(':agencyId/onboarding')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: { type: 'object', required: ['id', 'name', 'status'], properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string', nullable: true }, status: { type: 'string', enum: ['draft', 'submitted'] } } } })
  async onboarding(@Headers('authorization') authorization: string | undefined, @Param('agencyId') agencyId: string): Promise<{ id: string; name: string | null; status: string }> {
    const user = await authenticateUser(this.pool, authorization);
    if (!z.string().uuid().safeParse(agencyId).success) throw new BadRequestException();
    const result = await this.pool.query<{ id: string; name: string | null; status: string }>(
      'SELECT a.id, a.name, a.status FROM agencies a JOIN agency_memberships m ON m.agency_id = a.id WHERE a.id = $1 AND m.user_id = $2 AND m.active = true', [agencyId, user.id],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID unique pour cette demande ; réutiliser la même clé uniquement pour une nouvelle tentative identique.' })
  @ApiBody({ schema: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 160 } } } })
  @ApiCreatedResponse({ schema: { type: 'object', required: ['id', 'status'], properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['draft'] } } } })
  async create(@Headers('authorization') authorization: string | undefined, @Headers('idempotency-key') key: string | undefined, @Body() body: unknown): Promise<{ id: string; status: 'draft' }> {
    const user = await authenticateUser(this.pool, authorization);
    const parsed = inputSchema.safeParse(body);
    if (!key || !z.string().uuid().safeParse(key).success || !parsed.success) throw new BadRequestException();
    let draft;
    try { draft = createDraft(parsed.data.name); }
    catch (error) { if (error instanceof AgencyInputError) throw new BadRequestException(); throw error; }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const id = randomUUID();
      const inserted = await client.query<{ id: string }>(
        "INSERT INTO agencies (id, name, status, created_by, creation_key, creation_name) VALUES ($1, $2, 'draft', $3, $4, $2) ON CONFLICT (created_by, creation_key) DO NOTHING RETURNING id", [id, draft.name, user.id, key],
      );
      if (!inserted.rows[0]) {
        const existing = await client.query<{ id: string; creation_name: string }>('SELECT id, creation_name FROM agencies WHERE created_by = $1 AND creation_key = $2', [user.id, key]);
        if (!existing.rows[0] || existing.rows[0].creation_name !== draft.name) throw new ConflictException();
        await client.query('COMMIT');
        return { id: existing.rows[0].id, status: 'draft' };
      }
      await client.query("INSERT INTO agency_memberships (id, agency_id, user_id, role) VALUES ($1, $2, $3, 'owner')", [randomUUID(), id, user.id]);
      await client.query('INSERT INTO identity_audit (id, user_id, action, agency_id) VALUES ($1, $2, $3, $4)', [randomUUID(), user.id, 'agency.draft_created', id]);
      await client.query('COMMIT');
      return { id, status: 'draft' };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
