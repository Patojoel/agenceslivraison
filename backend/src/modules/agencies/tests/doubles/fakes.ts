import { UserId } from '@shared/domain/value-objects/user-id';
import { ReadAgencyRepository } from '../../application/ports/read-agency.repository';
import { AgencyReadModel } from '../../application/read-models/agency.read-model';
import { ActiveMembersCriteria, ReadAgencyMemberRepository } from '../../application/ports/read-agency-member.repository';
import { AgencyMemberReadModel } from '../../application/read-models/agency-member.read-model';
import { ReadAgencyOnboardingRepository } from '../../application/ports/read-agency-onboarding.repository';
import { AgencyOnboardingReadModel } from '../../application/read-models/agency-onboarding.read-model';
import { Agency } from '../../domain/agency';
import { AgencyRole } from '../../domain/agency-role';
import { AgencySnapshot, AgencyStatus } from '../../domain/agency.snapshot';
import { EMPTY_IDENTITY } from '../../domain/agency-identity';
import { siteDetailsOf } from '../../domain/agency-site';
import { AgencySiteId } from '../../domain/value-objects/agency-site-id';
import { ServiceArea } from '../../domain/value-objects/service-area';
import { ServiceZoneId } from '../../domain/value-objects/service-zone-id';
import { TradeName } from '../../domain/value-objects/trade-name';
import { AgencyTeam, Membership } from '../../domain/agency-team';
import { Invitation } from '../../domain/invitation';
import { InvitationSnapshot } from '../../domain/invitation.snapshot';
import { AgencyRepository } from '../../domain/ports/agency.repository';
import { AgencyTeamRepository } from '../../domain/ports/agency-team.repository';
import { InvitationRepository } from '../../domain/ports/invitation.repository';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { InvitationId } from '../../domain/value-objects/invitation-id';
import { MembershipId } from '../../domain/value-objects/membership-id';
import { T0, uuid } from '@shared/tests/doubles/fakes';

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

export function anAgency(status: AgencyStatus = 'draft', version = 1, id = AGENCY): Agency {
  return Agency.reconstitute({
    id: AgencyId.of(id), tradeName: TradeName.of('Express Douala'), description: null, identity: EMPTY_IDENTITY,
    status, submission: status === 'submitted' ? { at: T0, by: UserId.of(OWNER.user) } : null, version, createdBy: UserId.of(OWNER.user), createdAt: T0, zones: [], sites: [], capabilityTransitions: [],
  });
}

/** The agency with an active service zone, added by the owner at `T0`. */
export function withActiveZone(agency: Agency, n: number, city: string, district: string | null = null): Agency {
  agency.addZone(ServiceZoneId.of(uuid(500 + n)), ServiceArea.of(city, district), UserId.of(OWNER.user), T0);
  agency.pullEvents();
  return agency;
}

/** The agency with an active site, created by the owner at `T0`. */
export function withActiveSite(agency: Agency, n: number, name: string): Agency {
  agency.createSite(AgencySiteId.of(uuid(600 + n)), siteDetailsOf({ name, city: 'Douala', address: 'Rue Joss, Akwa', phone: null }), UserId.of(OWNER.user), T0);
  agency.pullEvents();
  return agency;
}

export class InMemoryAgencyRepository implements AgencyRepository {
  private readonly rows = new Map<string, AgencySnapshot>();
  saves = 0;

  async add(agency: Agency): Promise<void> {
    this.rows.set(agency.id.value, agency.snapshot());
  }

  async findById(id: AgencyId): Promise<Agency | null> {
    const state = this.rows.get(id.value);
    return state ? Agency.reconstitute(state) : null;
  }

  async save(agency: Agency): Promise<void> {
    this.saves += 1;
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

/** Rows are `[agencyId, userId of an active member, projection]`. */
export class InMemoryReadAgencyRepository implements ReadAgencyRepository {
  constructor(private readonly rows: readonly [string, string, AgencyReadModel][]) {}

  async findForMember(agencyId: string, userId: string): Promise<AgencyReadModel | null> {
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

export interface MemberRow {
  readonly agencyId: string;
  readonly membershipId: string;
  readonly userId: string;
  readonly role: AgencyRole;
  readonly active: boolean;
}

export class InMemoryReadAgencyMemberRepository implements ReadAgencyMemberRepository {
  constructor(private readonly rows: readonly MemberRow[]) {}

  async listActiveForMember(criteria: ActiveMembersCriteria): Promise<readonly AgencyMemberReadModel[]> {
    const isMember = await this.isActiveMember(criteria.agencyId, criteria.userId);
    if (!isMember) return [];
    return this.rows
      .filter(row => row.agencyId === criteria.agencyId && row.active && (criteria.after === null || row.membershipId > criteria.after))
      .sort((a, b) => (a.membershipId < b.membershipId ? -1 : 1))
      .slice(0, criteria.limit)
      .map(({ membershipId, userId, role }) => ({ membershipId, userId, role }));
  }

  async isActiveMember(agencyId: string, userId: string): Promise<boolean> {
    return this.rows.some(row => row.agencyId === agencyId && row.userId === userId && row.active);
  }
}
