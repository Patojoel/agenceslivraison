import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Header, HttpCode, Inject, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Pool } from 'pg';
import { z } from 'zod';
import { DATABASE_POOL } from '../../../../shared/infrastructure/db/create-pool';
import { LastOwner, MembershipForbidden, MembershipNotFound, MembershipRepository } from '../membership-repository';
import { AuthenticatedUser } from '../../../identity/application/queries/authenticate/authenticated-user';
import { AccessTokenGuard } from '../../../identity/infrastructure/security/access-token.guard';
import { CurrentUser } from '../../../identity/infrastructure/security/current-user.decorator';

const uuid = z.string().uuid();
const bodySchema = z.object({ role: z.enum(['owner', 'admin', 'agent']) }).strict();
@ApiTags('agency-members')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('agencies/:agencyId/members')
export class MembershipController {
  private readonly memberships: MembershipRepository;
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) { this.memberships = new MembershipRepository(pool); }

  @Patch(':memberId')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['owner', 'admin', 'agent'] } } } })
  @ApiOkResponse({ description: 'Rôle modifié.' })
  async change(@CurrentUser() user: AuthenticatedUser, @Param('agencyId') agencyId: string, @Param('memberId') memberId: string, @Body() body: unknown): Promise<{ success: true }> {
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
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('agencyId') agencyId: string, @Param('memberId') memberId: string): Promise<{ success: true }> {
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
