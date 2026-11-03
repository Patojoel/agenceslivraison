import { Email } from '@shared/domain/value-objects/email';
import { TokenDigest } from '@shared/domain/value-objects/token-digest';
import { UserId } from '@shared/domain/value-objects/user-id';
import { INVITATION_ROLES, InvitationRole } from '../../../domain/agency-role';
import { Invitation } from '../../../domain/invitation';
import { AgencyId } from '../../../domain/value-objects/agency-id';
import { InvitationId } from '../../../domain/value-objects/invitation-id';
import { AgencyInvitationOrmEntity } from './agency-invitation.orm-entity';

const isInvitationRole = (value: string): value is InvitationRole => INVITATION_ROLES.some(role => role === value);

export class InvitationMapper {
  static toDomain(entity: AgencyInvitationOrmEntity): Invitation {
    if (!isInvitationRole(entity.role)) throw new Error('Unknown invitation role in database');
    return Invitation.reconstitute({
      id: InvitationId.of(entity.id),
      agencyId: AgencyId.of(entity.agencyId),
      email: Email.of(entity.email),
      role: entity.role,
      tokenDigest: TokenDigest.of(entity.tokenDigest),
      createdBy: UserId.of(entity.createdBy),
      expiresAt: entity.expiresAt,
      acceptedAt: entity.acceptedAt,
    });
  }

  static toOrm(invitation: Invitation): AgencyInvitationOrmEntity {
    const snapshot = invitation.snapshot();
    const entity = new AgencyInvitationOrmEntity();
    entity.id = snapshot.id.value;
    entity.agencyId = snapshot.agencyId.value;
    entity.email = snapshot.email.value;
    entity.role = snapshot.role;
    entity.tokenDigest = snapshot.tokenDigest.value;
    entity.createdBy = snapshot.createdBy.value;
    entity.expiresAt = snapshot.expiresAt;
    entity.acceptedAt = snapshot.acceptedAt;
    return entity;
  }
}
