import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Header, Headers, HttpCode, Inject, NotFoundException, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { z } from 'zod';
import { DATABASE_POOL } from '../../../../shared/infrastructure/db/create-pool';
import { LastOwner, MembershipForbidden, MembershipNotFound, MembershipRepository } from '../membership-repository';
import { authenticateUser } from './session.controller';

const uuid = z.string().uuid();
const bodySchema = z.object({ role: z.enum(['owner', 'admin', 'agent']) }).strict();
@ApiTags('agency-members')
@ApiBearerAuth()
@Controller('agencies/:agencyId/members')
export class MembershipController {
  private readonly memberships: MembershipRepository;
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) { this.memberships = new MembershipRepository(pool); }

  @Patch(':memberId')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['owner', 'admin', 'agent'] } } } })
  @ApiOkResponse({ description: 'Rôle modifié.' })
  async change(@Headers('authorization') authorization: string | undefined, @Param('agencyId') agencyId: string, @Param('memberId') memberId: string, @Body() body: unknown): Promise<{ success: true }> {
    const user = await authenticateUser(this.pool, authorization);
    const parsed = bodySchema.safeParse(body);
    if (!uuid.safeParse(agencyId).success || !uuid.safeParse(memberId).success || !parsed.success) throw new BadRequestException();
    try { await this.memberships.change(user.id, agencyId, memberId, parsed.data.role, true); }
    catch (error) { this.translate(error); }
    return { success: true };
  }

  @Delete(':memberId')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ description: 'Accès retiré.' })
  async remove(@Headers('authorization') authorization: string | undefined, @Param('agencyId') agencyId: string, @Param('memberId') memberId: string): Promise<{ success: true }> {
    const user = await authenticateUser(this.pool, authorization);
    if (!uuid.safeParse(agencyId).success || !uuid.safeParse(memberId).success) throw new BadRequestException();
    // The repository resolves and checks the target role inside the same transaction.
    try { await this.memberships.remove(user.id, agencyId, memberId); }
    catch (error) { this.translate(error); }
    return { success: true };
  }

  private translate(error: unknown): never {
    if (error instanceof MembershipNotFound) throw new NotFoundException();
    if (error instanceof MembershipForbidden) throw new ForbiddenException();
    if (error instanceof LastOwner) throw new ConflictException();
    throw error;
  }
}
