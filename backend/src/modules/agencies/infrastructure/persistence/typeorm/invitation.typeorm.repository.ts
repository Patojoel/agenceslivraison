import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { Invitation } from '../../../domain/invitation';
import { InvitationRepository } from '../../../domain/ports/invitation.repository';
import { InvitationId } from '../../../domain/value-objects/invitation-id';
import { AgencyInvitationOrmEntity } from './agency-invitation.orm-entity';
import { InvitationMapper } from './invitation.mapper';

@Injectable()
export class InvitationTypeOrmRepository implements InvitationRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async add(invitation: Invitation): Promise<void> {
    const manager = await this.connection.manager();
    await manager.insert(AgencyInvitationOrmEntity, InvitationMapper.toOrm(invitation));
  }

  /** `FOR UPDATE`: must run inside the command's transaction. */
  async findForUpdate(id: InvitationId): Promise<Invitation | null> {
    const manager = await this.connection.manager();
    const entity = await manager.findOne(AgencyInvitationOrmEntity, { where: { id: id.value }, lock: { mode: 'pessimistic_write' } });
    return entity ? InvitationMapper.toDomain(entity) : null;
  }

  /** Acceptance is the only change an invitation goes through. */
  async save(invitation: Invitation): Promise<void> {
    const manager = await this.connection.manager();
    const { id, acceptedAt } = invitation.snapshot();
    await manager.update(AgencyInvitationOrmEntity, { id: id.value }, { acceptedAt });
  }
}
