import { UserId } from '../../src/shared/domain/vo/user-id';
import { AgencyRole } from '../../src/modules/agencies/domain/agency-role';
import { AgencyTeam, Membership } from '../../src/modules/agencies/domain/model/agency-team';
import { Invitation, InvitationState } from '../../src/modules/agencies/domain/model/invitation';
import { AgencyTeamRepository } from '../../src/modules/agencies/domain/repositories/agency-team.repository';
import { InvitationRepository } from '../../src/modules/agencies/domain/repositories/invitation.repository';
import { AgencyId } from '../../src/modules/agencies/domain/vo/agency-id';
import { InvitationId } from '../../src/modules/agencies/domain/vo/invitation-id';
import { MembershipId } from '../../src/modules/agencies/domain/vo/membership-id';
import { uuid } from '../support/fakes';

export const AGENCY = uuid(10);
export const OTHER_AGENCY = uuid(11);
export const OWNER = { user: uuid(1), membership: uuid(21) };
export const ADMIN = { user: uuid(2), membership: uuid(22) };
export const AGENT = { user: uuid(3), membership: uuid(23) };

export function membership(member: { user: string; membership: string }, role: AgencyRole, active = true): Membership {
  return { id: MembershipId.of(member.membership), userId: UserId.of(member.user), role, active };
}

export function team(...memberships: Membership[]): AgencyTeam {
  return AgencyTeam.reconstitute(AgencyId.of(AGENCY), memberships);
}

export class InMemoryAgencyTeamRepository implements AgencyTeamRepository {
  private readonly rows = new Map<string, readonly Membership[]>();

  constructor(...memberships: Membership[]) {
    this.rows.set(AGENCY, memberships);
  }

  async lockAndLoad(agencyId: AgencyId): Promise<AgencyTeam> {
    return AgencyTeam.reconstitute(agencyId, this.rows.get(agencyId.value) ?? []);
  }

  async save(saved: AgencyTeam): Promise<void> {
    this.rows.set(saved.agencyId.value, saved.snapshot());
  }

  memberships(agencyId = AGENCY): readonly Membership[] {
    return this.rows.get(agencyId) ?? [];
  }
}

export class InMemoryInvitationRepository implements InvitationRepository {
  private readonly rows = new Map<string, InvitationState>();

  async add(invitation: Invitation): Promise<void> {
    this.rows.set(invitation.id.value, invitation.snapshot());
  }

  async findForUpdate(id: InvitationId): Promise<Invitation | null> {
    const state = this.rows.get(id.value);
    return state ? Invitation.reconstitute(state) : null;
  }

  async save(invitation: Invitation): Promise<void> {
    this.rows.set(invitation.id.value, invitation.snapshot());
  }

  stored(id: string): InvitationState | undefined {
    return this.rows.get(id);
  }
}
