import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencySnapshot } from './agency.snapshot';
import { changedFields, EMPTY_IDENTITY, IDENTITY_FIELDS, IdentityChange, PROFILE_FIELDS, ProfileChange, withFields } from './agency-identity';
import { AgencyEvent } from './events/agency-events';
import { AgencyIdentityLocked, StaleAgencyVersion } from './exceptions/agency.exceptions';
import { AgencyId } from './value-objects/agency-id';
import { TradeName } from './value-objects/trade-name';

export interface NewAgency {
  readonly id: AgencyId;
  readonly tradeName: TradeName;
  readonly createdBy: UserId;
}

export class Agency extends AggregateRoot<AgencyEvent> {
  private constructor(private state: AgencySnapshot) {
    super();
  }

  static draft(details: NewAgency, now: Date): Agency {
    const agency = new Agency({ ...details, description: null, identity: EMPTY_IDENTITY, status: 'draft', version: 1, createdAt: now });
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

  private assertVersion(expected: number): void {
    if (expected !== this.state.version) throw new StaleAgencyVersion();
  }
}
