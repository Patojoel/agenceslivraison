import { uuid } from '@shared/tests/doubles/fakes';
import { UserId } from '@shared/domain/value-objects/user-id';
import { RateCard } from '../../domain/rate-card';
import { RateCardContent, RawLine } from '../../domain/rate-card-content';
import { RateCardVersion } from '../../domain/rate-card-version';
import { RateCardRepository } from '../../domain/ports/rate-card.repository';
import { RateCardAlreadyExists, StaleRateCardVersion } from '../../domain/exceptions/pricing.exceptions';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { RateCardId } from '../../domain/value-objects/rate-card-id';
import { AgencyAccess, DeliveryAgencyState, DeliveryZone, MemberRole } from '../../application/ports/agency-access.port';
import { ListVersionsCriteria, ReadRateCardRepository } from '../../application/ports/read-rate-card.repository';
import { RateCardVersionRecord, recordOfVersion, VersionSummaryReadModel } from '../../application/read-models/rate-card.read-model';

export const AGENCY = uuid(10);
export const OTHER_AGENCY = uuid(11);
export const OWNER = uuid(1);
export const ADMIN = uuid(2);
export const AGENT = uuid(3);
export const FORMER = uuid(4);
export const OUTSIDER = uuid(5);
export const OTHER_OWNER = uuid(6);

export const AKWA = uuid(501);
export const BONABERI = uuid(502);
export const DEIDO = uuid(503);
export const RETIRED_ZONE = uuid(504);
export const FOREIGN_ZONE = uuid(901);

export const AKWA_TIERS = [{ upTo: '1 kg', price: 1000 }, { upTo: '5 kg', price: 1500 }, { upTo: '10 kg', price: 2500 }, { upTo: '30 kg', price: 5000 }];
export const BONABERI_TIERS = [{ upTo: '1 kg', price: 1500 }];

export const DELIVERY_ZONES: readonly DeliveryZone[] = [
  { id: AKWA, city: 'Douala', district: 'Akwa', active: true },
  { id: BONABERI, city: 'Douala', district: 'Bonabéri', active: true },
  { id: DEIDO, city: 'Douala', district: 'Deïdo', active: true },
  { id: RETIRED_ZONE, city: 'Douala', district: 'Bépanda', active: false },
];

export const scale = (lines: readonly RawLine[] = [{ zoneId: AKWA, tiers: AKWA_TIERS }, { zoneId: BONABERI, tiers: BONABERI_TIERS }], divisor: number | null = null) => ({ volumetricDivisor: divisor, lines });

export class FakeAgencyAccess implements AgencyAccess {
  private readonly roles = new Map<string, MemberRole>();
  private readonly zones = new Map<string, readonly DeliveryZone[]>();
  /** How many times the agency was locked: an actor who is refused must not have taken the lock. */
  sharedLocks = 0;
  /** Called after the lock is taken, to simulate a change of role made while the caller was waiting. */
  onLock: (() => void) | null = null;

  constructor() {
    this.setRole(AGENCY, OWNER, 'owner');
    this.setRole(AGENCY, ADMIN, 'admin');
    this.setRole(AGENCY, AGENT, 'agent');
    this.setRole(OTHER_AGENCY, OTHER_OWNER, 'owner');
    this.zones.set(AGENCY, DELIVERY_ZONES);
  }

  setRole(agencyId: string, userId: string, role: MemberRole | null): void {
    if (role === null) this.roles.delete(`${agencyId}|${userId}`);
    else this.roles.set(`${agencyId}|${userId}`, role);
  }

  async activeRoleOf(agencyId: string, userId: string): Promise<MemberRole | null> {
    return this.roles.get(`${agencyId}|${userId}`) ?? null;
  }

  async deliveryState(agencyId: string): Promise<DeliveryAgencyState> {
    return { deliveryActive: true, zones: this.zones.get(agencyId) ?? [] };
  }

  async deliveryStateLockedShared(agencyId: string): Promise<DeliveryAgencyState> {
    this.sharedLocks += 1;
    this.onLock?.();
    return this.deliveryState(agencyId);
  }
}

/** The write and the read side of the rate cards over the same rows, versions kept as history like in the database. */
export class InMemoryRateCardStore implements RateCardRepository, ReadRateCardRepository {
  private readonly cards = new Map<string, { id: string; current: number }>();
  private readonly versions = new Map<string, RateCardVersionRecord[]>();
  private readonly loaded = new WeakMap<RateCard, number>();
  adds = 0;
  saves = 0;
  locks = 0;
  /** The version numbers written by `save`, to prove that a version already written is never rewritten. */
  readonly writtenVersions: number[] = [];

  async findByAgency(agencyId: AgencyId): Promise<RateCard | null> {
    const card = this.cards.get(agencyId.value);
    const current = this.versions.get(agencyId.value)?.find(version => version.number === card?.current);
    if (!card || !current) return null;
    const aggregate = RateCard.reconstitute({
      id: RateCardId.of(card.id), agencyId,
      current: new RateCardVersion(current.number, contentOf(current), UserId.of(current.createdBy), new Date(current.createdAt)),
    });
    this.loaded.set(aggregate, current.number);
    return aggregate;
  }

  async lockByAgency(agencyId: AgencyId): Promise<RateCard | null> {
    this.locks += 1;
    return this.findByAgency(agencyId);
  }

  async add(card: RateCard): Promise<void> {
    const { id, agencyId, current } = card.snapshot();
    if (this.cards.has(agencyId.value)) throw new RateCardAlreadyExists();
    this.adds += 1;
    this.cards.set(agencyId.value, { id: id.value, current: current.number });
    this.versions.set(agencyId.value, [recordOfVersion(id.value, current)]);
    this.loaded.set(card, current.number);
  }

  async save(card: RateCard): Promise<void> {
    const { id, agencyId, current } = card.snapshot();
    const stored = this.cards.get(agencyId.value);
    if (!stored || stored.current !== current.number - 1) throw new StaleRateCardVersion();
    this.saves += 1;
    stored.current = current.number;
    this.writtenVersions.push(current.number);
    this.versions.get(agencyId.value)?.push(recordOfVersion(id.value, current));
    this.loaded.set(card, current.number);
  }

  async findVersion(agencyId: string, number: number | null): Promise<RateCardVersionRecord | null> {
    const wanted = number ?? this.cards.get(agencyId)?.current;
    return this.versions.get(agencyId)?.find(version => version.number === wanted) ?? null;
  }

  async listVersions(criteria: ListVersionsCriteria): Promise<readonly VersionSummaryReadModel[]> {
    return [...(this.versions.get(criteria.agencyId) ?? [])]
      .filter(version => criteria.before === null || version.number < criteria.before)
      .sort((left, right) => right.number - left.number)
      .slice(0, criteria.limit)
      .map(version => ({ number: version.number, createdAt: version.createdAt, createdBy: version.createdBy, volumetricDivisor: version.volumetricDivisor, zoneCount: version.lines.length }));
  }

  versionNumbers(agencyId: string): number[] {
    return (this.versions.get(agencyId) ?? []).map(version => version.number);
  }
}

function contentOf(record: RateCardVersionRecord): RateCardContent {
  return RateCardContent.of(record.volumetricDivisor, record.lines.map(line => ({
    zoneId: line.zoneId,
    tiers: line.tiers.map(tier => ({ upTo: `${tier.upToGrams} g`, price: tier.price })),
  })));
}
