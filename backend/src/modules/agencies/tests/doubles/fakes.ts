import { UserId } from '@shared/domain/value-objects/user-id';
import { ReadAgencyOnboardingRepository } from '../../application/ports/read-agency-onboarding.repository';
import { AgencyOnboardingReadModel } from '../../application/read-models/agency-onboarding.read-model';
import { Agency } from '../../domain/agency';
import { AgencyRole } from '../../domain/agency-role';
import { AgencySnapshot } from '../../domain/agency.snapshot';
import { AgencyTeam, Membership } from '../../domain/agency-team';
import { Invitation } from '../../domain/invitation';
import { InvitationSnapshot } from '../../domain/invitation.snapshot';
import { AgencyRepository } from '../../domain/ports/agency.repository';
import { AgencyTeamRepository } from '../../domain/ports/agency-team.repository';
import { InvitationRepository } from '../../domain/ports/invitation.repository';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { InvitationId } from '../../domain/value-objects/invitation-id';
import { MembershipId } from '../../domain/value-objects/membership-id';
import { uuid } from '@shared/tests/doubles/fakes';

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

export class InMemoryAgencyRepository implements AgencyRepository {
  private readonly rows = new Map<string, AgencySnapshot>();

  async add(agency: Agency): Promise<void> {
    this.rows.set(agency.id.value, agency.snapshot());
  }

  stored(id: string): AgencySnapshot | undefined {
    return this.rows.get(id);
  }

  count(): number {
    return this.rows.size;
  }
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

/** Rows are `[agencyId, userId of an active member, projection]`. */
export class InMemoryReadAgencyOnboardingRepository implements ReadAgencyOnboardingRepository {
  constructor(private readonly rows: readonly [string, string, AgencyOnboardingReadModel][]) {}

  async findForMember(agencyId: string, userId: string): Promise<AgencyOnboardingReadModel | null> {
    return this.rows.find(([agency, user]) => agency === agencyId && user === userId)?.[2] ?? null;
  }
}

export class InMemoryInvitationRepository implements InvitationRepository {
  private readonly rows = new Map<string, InvitationSnapshot>();

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

  stored(id: string): InvitationSnapshot | undefined {
    return this.rows.get(id);
  }
}
