import { uuid } from '@shared/tests/doubles/fakes';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyPublicProfile, PublicProfileSnapshot } from '../../domain/agency-public-profile';
import { AgencyPublicView } from '../../domain/agency-public-view';
import { PublicListing } from '../../domain/public-listing';
import { AddProfileOutcome, AgencyPublicProfileRepository } from '../../domain/ports/agency-public-profile.repository';
import { AgencyId } from '../../domain/value-objects/agency-id';
import { PublicSlug } from '../../domain/value-objects/public-slug';
import { AgencyAccess, MemberRole } from '../../application/ports/agency-access.port';
import { PublicListingWriter } from '../../application/ports/public-listing.writer';
import { PublicPrices } from '../../application/ports/public-prices.port';
import { PublicProfileRecord, ReadAgencyPublicProfileRepository } from '../../application/ports/read-agency-public-profile.repository';

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

/** The agency as `agencies` exposes it: submitted, delivering, with two zones and one site. */
export function view(overrides: Partial<AgencyPublicView> = {}): AgencyPublicView {
  return {
    submitted: true,
    tradeName: 'Express Douala',
    description: 'Livraison rapide',
    capabilities: ['delivery'],
    zones: [{ id: AKWA, city: 'Douala', district: 'Akwa' }, { id: BONABERI, city: 'Douala', district: 'Bonabéri' }],
    siteCities: ['Douala'],
    ...overrides,
  };
}

export class FakeAgencyAccess implements AgencyAccess {
  private readonly roles = new Map<string, MemberRole>();
  private readonly views = new Map<string, AgencyPublicView>();
  publicationLocks = 0;
  /** Called after the lock is taken, to simulate a change made while the caller was waiting. */
  onLock: (() => void) | null = null;

  constructor() {
    this.setRole(AGENCY, OWNER, 'owner');
    this.setRole(AGENCY, ADMIN, 'admin');
    this.setRole(AGENCY, AGENT, 'agent');
    this.setRole(OTHER_AGENCY, OTHER_OWNER, 'owner');
    this.views.set(AGENCY, view());
    this.views.set(OTHER_AGENCY, view({ tradeName: 'Rapide Yaoundé' }));
  }

  setRole(agencyId: string, userId: string, role: MemberRole | null): void {
    if (role === null) this.roles.delete(`${agencyId}|${userId}`);
    else this.roles.set(`${agencyId}|${userId}`, role);
  }

  setView(agencyId: string, next: AgencyPublicView): void {
    this.views.set(agencyId, next);
  }

  async activeRoleOf(agencyId: string, userId: string): Promise<MemberRole | null> {
    return this.roles.get(`${agencyId}|${userId}`) ?? null;
  }

  async publicViewOf(agencyId: string): Promise<AgencyPublicView | null> {
    return this.views.get(agencyId) ?? null;
  }

  async publicViewOfLockedForPublication(agencyId: string): Promise<AgencyPublicView | null> {
    this.publicationLocks += 1;
    this.onLock?.();
    return this.publicViewOf(agencyId);
  }
}

/** The write and the read side of the profiles over the same rows; slugs are unique, as the database makes them. */
export class InMemoryProfiles implements AgencyPublicProfileRepository, ReadAgencyPublicProfileRepository {
  private readonly rows = new Map<string, PublicProfileSnapshot>();
  adds = 0;
  saves = 0;
  locks = 0;
  /** Slugs that another agency already holds, whatever this store contains. */
  readonly foreignSlugs = new Set<string>();
  /** Called when `add` is about to answer, to simulate a concurrent first publication of the same agency. */
  onAdd: (() => void) | null = null;

  async lockByAgency(agencyId: AgencyId): Promise<AgencyPublicProfile | null> {
    this.locks += 1;
    const snapshot = this.rows.get(agencyId.value);
    return snapshot ? AgencyPublicProfile.reconstitute(snapshot) : null;
  }

  async add(profile: AgencyPublicProfile): Promise<AddProfileOutcome> {
    const snapshot = profile.snapshot();
    this.onAdd?.();
    if (this.rows.has(snapshot.agencyId.value)) return 'already_has_profile';
    const taken = this.foreignSlugs.has(snapshot.slug.value) || [...this.rows.values()].some(row => row.slug.value === snapshot.slug.value);
    if (taken) return 'slug_taken';
    this.adds += 1;
    this.rows.set(snapshot.agencyId.value, snapshot);
    return 'added';
  }

  async save(profile: AgencyPublicProfile): Promise<void> {
    this.saves += 1;
    const snapshot = profile.snapshot();
    this.rows.set(snapshot.agencyId.value, snapshot);
  }

  async findRecord(agencyId: string): Promise<PublicProfileRecord | null> {
    const snapshot = this.rows.get(agencyId);
    return snapshot ? { slug: snapshot.slug.value, published: snapshot.published, publishedAt: snapshot.publishedAt, unpublishedAt: snapshot.unpublishedAt } : null;
  }

  seed(agencyId: string, slug: string, published: boolean, at: Date): void {
    this.rows.set(agencyId, {
      agencyId: AgencyId.of(agencyId), slug: PublicSlug.reconstitute(slug), published, publishedAt: at,
      publishedBy: UserId.of(OWNER), unpublishedAt: published ? null : at,
    });
  }

  slugOf(agencyId: string): string | undefined {
    return this.rows.get(agencyId)?.slug.value;
  }
}

export class FakePrices implements PublicPrices {
  private readonly prices = new Map<string, ReadonlyMap<string, number>>();
  failWith: Error | null = null;

  set(agencyId: string, byZone: Record<string, number>): void {
    this.prices.set(agencyId, new Map(Object.entries(byZone)));
  }

  async startingPricesByZone(agencyId: string): Promise<ReadonlyMap<string, number>> {
    if (this.failWith) throw this.failWith;
    return this.prices.get(agencyId) ?? new Map();
  }
}

export class InMemoryListings implements PublicListingWriter {
  readonly rows = new Map<string, PublicListing>();
  upserts = 0;
  failWith: Error | null = null;

  async upsert(listing: PublicListing): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.upserts += 1;
    this.rows.set(listing.agencyId, listing);
  }

  of(agencyId: string): PublicListing | undefined {
    return this.rows.get(agencyId);
  }
}
