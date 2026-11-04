import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencySnapshot } from './agency.snapshot';
import { changedFields, EMPTY_IDENTITY, IDENTITY_FIELDS, IdentityChange, PROFILE_FIELDS, ProfileChange, withFields } from './agency-identity';
import { AgencySite, SITE_FIELDS, SiteChange, SiteDetails } from './agency-site';
import { CAPABILITY_TYPES, CapabilityState, CapabilityTransition, CapabilityType, REQUIREMENT_OF } from './capability';
import { AgencyEvent } from './events/agency-events';
import {
  AgencyIdentityLocked, AgencySiteNotFound, CapabilityAlreadyActive, CapabilityNotActive, CapabilityPrerequisiteMissing, LastActiveSite, LastActiveZone,
  ServiceZoneAlreadyRetired, ServiceZoneAlreadyServed, ServiceZoneLimitReached, ServiceZoneNotFound, SiteAlreadyActive, SiteDeactivated, SiteNameTaken,
  StaleAgencyVersion, StaleSiteVersion,
} from './exceptions/agency.exceptions';
import { MAX_ACTIVE_ZONES, ServiceZone } from './service-zone';
import { AgencyId } from './value-objects/agency-id';
import { AgencySiteId } from './value-objects/agency-site-id';
import { ServiceArea } from './value-objects/service-area';
import { ServiceZoneId } from './value-objects/service-zone-id';
import { SuspensionReason } from './value-objects/suspension-reason';
import { TradeName } from './value-objects/trade-name';

export interface NewAgency {
  readonly id: AgencyId;
  readonly tradeName: TradeName;
  readonly createdBy: UserId;
}

/**
 * The agency and everything its configuration rules tie together: identity, profile, served zones,
 * sites and capabilities. A capability needs a zone or a site, so they are decided in one place.
 */
export class Agency extends AggregateRoot<AgencyEvent> {
  private constructor(private state: AgencySnapshot) {
    super();
  }

  static draft(details: NewAgency, now: Date): Agency {
    const agency = new Agency({ ...details, description: null, identity: EMPTY_IDENTITY, status: 'draft', version: 1, createdAt: now, zones: [], sites: [], capabilityTransitions: [] });
    agency.record({ type: 'AgencyRegistered', agencyId: details.id.value, actorId: details.createdBy.value });
    return agency;
  }

  static reconstitute(state: AgencySnapshot): Agency {
    return new Agency(state);
  }

  get id(): AgencyId { return this.state.id; }

  snapshot(): AgencySnapshot {
    return this.state;
  }

  /** Legal identity: only while the agency is a draft. A request that changes nothing leaves version and events alone. */
  completeIdentity(change: IdentityChange, actorId: UserId, expectedVersion: number): void {
    if (this.state.status !== 'draft') throw new AgencyIdentityLocked();
    this.assertVersion(expectedVersion);
    const fields = changedFields(IDENTITY_FIELDS, this.state.identity, change);
    if (fields.length === 0) return;
    this.state = { ...this.state, identity: withFields(this.state.identity, change, fields), version: this.state.version + 1 };
    this.record({ type: 'AgencyIdentityUpdated', agencyId: this.state.id.value, actorId: actorId.value, fields });
  }

  /** Presentation: editable in every status, so a submitted agency can still keep it accurate. */
  updateProfile(change: ProfileChange, actorId: UserId, expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    const current = { tradeName: this.state.tradeName, description: this.state.description };
    const fields = changedFields(PROFILE_FIELDS, current, change);
    if (fields.length === 0) return;
    this.state = { ...this.state, ...withFields(current, change, fields), version: this.state.version + 1 };
    this.record({ type: 'AgencyProfileUpdated', agencyId: this.state.id.value, actorId: actorId.value, fields });
  }

  /** Adding a zone that was retired brings the same zone back, so whatever points at it keeps pointing at it. */
  addZone(id: ServiceZoneId, area: ServiceArea, actorId: UserId, now: Date): ServiceZone {
    const known = this.state.zones.find(zone => zone.area.sameAs(area));
    if (known && known.retiredAt === null) throw new ServiceZoneAlreadyServed();
    if (this.activeZones().length >= MAX_ACTIVE_ZONES) throw new ServiceZoneLimitReached();
    const zone: ServiceZone = known ? { ...known, retiredAt: null } : { id, area, addedAt: now, retiredAt: null };
    this.state = { ...this.state, zones: known ? this.state.zones.map(item => (item === known ? zone : item)) : [...this.state.zones, zone] };
    this.record({ type: 'ServiceZoneAdded', agencyId: this.state.id.value, actorId: actorId.value, zoneId: zone.id.value, reactivated: known !== undefined });
    return zone;
  }

  /** Delivery is never active without a zone to serve: the last active zone is kept while it is. */
  retireZone(id: ServiceZoneId, actorId: UserId, now: Date): ServiceZone {
    const zone = this.state.zones.find(item => item.id.equals(id));
    if (!zone) throw new ServiceZoneNotFound();
    if (zone.retiredAt !== null) throw new ServiceZoneAlreadyRetired();
    if (this.isCapabilityActive('delivery') && this.activeZones().length === 1) throw new LastActiveZone();
    const retired: ServiceZone = { ...zone, retiredAt: now };
    this.state = { ...this.state, zones: this.state.zones.map(item => (item === zone ? retired : item)) };
    this.record({ type: 'ServiceZoneRetired', agencyId: this.state.id.value, actorId: actorId.value, zoneId: zone.id.value });
    return retired;
  }

  createSite(id: AgencySiteId, details: SiteDetails, actorId: UserId, now: Date): AgencySite {
    this.assertNameFree(details.name.key, null);
    const site: AgencySite = { id, ...details, createdAt: now, deactivatedAt: null, version: 1 };
    this.state = { ...this.state, sites: [...this.state.sites, site] };
    this.record({ type: 'AgencySiteCreated', agencyId: this.state.id.value, actorId: actorId.value, siteId: id.value });
    return site;
  }

  /** A change that alters nothing leaves the site version and the events alone. */
  updateSite(id: AgencySiteId, change: SiteChange, actorId: UserId, expectedVersion: number): AgencySite {
    const site = this.siteOf(id);
    if (site.deactivatedAt !== null) throw new SiteDeactivated();
    if (expectedVersion !== site.version) throw new StaleSiteVersion();
    const fields = changedFields(SITE_FIELDS, site, change);
    if (fields.length === 0) return site;
    const updated: AgencySite = { ...withFields(site, change, fields), version: site.version + 1 };
    this.assertNameFree(updated.name.key, site);
    this.replaceSite(site, updated);
    this.record({ type: 'AgencySiteUpdated', agencyId: this.state.id.value, actorId: actorId.value, siteId: id.value, fields });
    return updated;
  }

  /** Storage is never active without a site to store in: the last active site is kept while it is. */
  deactivateSite(id: AgencySiteId, actorId: UserId, now: Date): AgencySite {
    const site = this.siteOf(id);
    if (site.deactivatedAt !== null) throw new SiteDeactivated();
    if (this.isCapabilityActive('storage') && this.activeSites().length === 1) throw new LastActiveSite();
    const deactivated: AgencySite = { ...site, deactivatedAt: now, version: site.version + 1 };
    this.replaceSite(site, deactivated);
    this.record({ type: 'AgencySiteDeactivated', agencyId: this.state.id.value, actorId: actorId.value, siteId: id.value });
    return deactivated;
  }

  reactivateSite(id: AgencySiteId, actorId: UserId): AgencySite {
    const site = this.siteOf(id);
    if (site.deactivatedAt === null) throw new SiteAlreadyActive();
    this.assertNameFree(site.name.key, site);
    const reactivated: AgencySite = { ...site, deactivatedAt: null, version: site.version + 1 };
    this.replaceSite(site, reactivated);
    this.record({ type: 'AgencySiteReactivated', agencyId: this.state.id.value, actorId: actorId.value, siteId: id.value });
    return reactivated;
  }

  /** Also brings a suspended capability back: the minimal configuration is checked again. */
  enableCapability(type: CapabilityType, actorId: UserId, now: Date): CapabilityState {
    const last = this.lastTransition(type);
    if (last?.kind === 'activated') throw new CapabilityAlreadyActive();
    const missing = this.missingFor(type);
    if (missing.length > 0) throw new CapabilityPrerequisiteMissing(missing);
    this.appendTransition({ type, kind: 'activated', sequence: (last?.sequence ?? 0) + 1, occurredAt: now, actorId, reason: null });
    this.record({ type: 'AgencyCapabilityEnabled', agencyId: this.state.id.value, actorId: actorId.value, capability: type });
    return this.stateOf(type);
  }

  suspendCapability(type: CapabilityType, reason: SuspensionReason, actorId: UserId, now: Date): CapabilityState {
    const last = this.lastTransition(type);
    if (last?.kind !== 'activated') throw new CapabilityNotActive();
    this.appendTransition({ type, kind: 'suspended', sequence: last.sequence + 1, occurredAt: now, actorId, reason });
    this.record({ type: 'AgencyCapabilitySuspended', agencyId: this.state.id.value, actorId: actorId.value, capability: type });
    return this.stateOf(type);
  }

  /** The capabilities that were ever enabled, with their current state. */
  capabilityStates(): readonly CapabilityState[] {
    return CAPABILITY_TYPES.filter(type => this.lastTransition(type) !== null).map(type => this.stateOf(type));
  }

  isHybrid(): boolean {
    return CAPABILITY_TYPES.every(type => this.isCapabilityActive(type));
  }

  /** A suspended capability takes no new request; requests already accepted are not its concern. */
  acceptsNewRequests(type: CapabilityType): boolean {
    return this.isCapabilityActive(type);
  }

  private assertVersion(expected: number): void {
    if (expected !== this.state.version) throw new StaleAgencyVersion();
  }

  private activeZones(): readonly ServiceZone[] {
    return this.state.zones.filter(zone => zone.retiredAt === null);
  }

  private activeSites(): readonly AgencySite[] {
    return this.state.sites.filter(site => site.deactivatedAt === null);
  }

  private siteOf(id: AgencySiteId): AgencySite {
    const site = this.state.sites.find(item => item.id.equals(id));
    if (!site) throw new AgencySiteNotFound();
    return site;
  }

  private replaceSite(previous: AgencySite, next: AgencySite): void {
    this.state = { ...this.state, sites: this.state.sites.map(item => (item === previous ? next : item)) };
  }

  /** `own` is the site being changed: it may keep its name. */
  private assertNameFree(key: string, own: AgencySite | null): void {
    if (this.activeSites().some(site => site !== own && site.name.key === key)) throw new SiteNameTaken();
  }

  private lastTransition(type: CapabilityType): CapabilityTransition | null {
    return [...this.state.capabilityTransitions].reverse().find(transition => transition.type === type) ?? null;
  }

  private isCapabilityActive(type: CapabilityType): boolean {
    return this.lastTransition(type)?.kind === 'activated';
  }

  private appendTransition(transition: CapabilityTransition): void {
    this.state = { ...this.state, capabilityTransitions: [...this.state.capabilityTransitions, transition] };
  }

  private stateOf(type: CapabilityType): CapabilityState {
    const last = this.lastTransition(type);
    if (!last) throw new CapabilityNotActive();
    const active = last.kind === 'activated';
    return { type, state: active ? 'active' : 'suspended', since: last.occurredAt, reason: last.reason?.value ?? null, acceptsNewRequests: active };
  }

  private missingFor(type: CapabilityType): readonly string[] {
    const met = type === 'delivery' ? this.activeZones().length > 0 : this.activeSites().length > 0;
    return met ? [] : [REQUIREMENT_OF[type]];
  }
}
