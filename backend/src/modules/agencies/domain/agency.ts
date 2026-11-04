import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencySnapshot } from './agency.snapshot';
import { AgencyEvent } from './events/agency-events';
import { AgencyId } from './value-objects/agency-id';
import { TradeName } from './value-objects/trade-name';

export interface NewAgency {
  readonly id: AgencyId;
  readonly tradeName: TradeName;
  readonly createdBy: UserId;
}

export class Agency extends AggregateRoot<AgencyEvent> {
  private constructor(private readonly state: AgencySnapshot) {
    super();
  }

  static draft(details: NewAgency, now: Date): Agency {
    const agency = new Agency({ ...details, status: 'draft', version: 1, createdAt: now });
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
}
