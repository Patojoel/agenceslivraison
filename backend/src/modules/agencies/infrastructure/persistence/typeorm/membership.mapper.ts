import { UserId } from '@shared/domain/value-objects/user-id';
import { Membership } from '../../../domain/agency-team';
import { AGENCY_ROLES, AgencyRole } from '../../../domain/agency-role';
import { MembershipId } from '../../../domain/value-objects/membership-id';
import { AgencyMembershipOrmEntity } from './agency-membership.orm-entity';

const isAgencyRole = (value: string): value is AgencyRole => AGENCY_ROLES.some(role => role === value);

export class MembershipMapper {
  static toDomain(entity: AgencyMembershipOrmEntity): Membership {
    if (!isAgencyRole(entity.role)) throw new Error('Unknown agency role in database');
    return { id: MembershipId.of(entity.id), userId: UserId.of(entity.userId), role: entity.role, active: entity.active };
  }
}
