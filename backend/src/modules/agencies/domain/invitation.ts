import { AggregateRoot } from '@shared/domain/aggregate-root';
import { Email } from '@shared/domain/value-objects/email';
import { TokenDigest } from '@shared/domain/value-objects/token-digest';
import { UserId } from '@shared/domain/value-objects/user-id';
import { InvitationRole } from './agency-role';
import { AgencyEvent } from './events/agency-events';
import { InvitationNotFound } from './exceptions/agency.exceptions';
import { InvitationSnapshot } from './invitation.snapshot';
import { AgencyId } from './value-objects/agency-id';
import { InvitationId } from './value-objects/invitation-id';

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface Invitee {
  readonly userId: UserId;
  readonly email: Email | null;
}

export class Invitation extends AggregateRoot<AgencyEvent> {
  private constructor(private state: InvitationSnapshot) {
    super();
  }

  static issue(details: Omit<InvitationSnapshot, 'expiresAt' | 'acceptedAt'>, now: Date): Invitation {
    const invitation = new Invitation({ ...details, expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS), acceptedAt: null });
    invitation.record({ type: 'InvitationIssued', agencyId: details.agencyId.value, actorId: details.createdBy.value });
    return invitation;
  }

  static reconstitute(state: InvitationSnapshot): Invitation {
    return new Invitation(state);
  }

  get id(): InvitationId { return this.state.id; }
  get agencyId(): AgencyId { return this.state.agencyId; }
  get role(): InvitationRole { return this.state.role; }
  get expiresAt(): Date { return this.state.expiresAt; }

  snapshot(): InvitationSnapshot {
    return this.state;
  }

  accept(presented: TokenDigest, invitee: Invitee, now: Date): void {
    const pending = this.state.acceptedAt === null && now < this.state.expiresAt;
    const addressed = invitee.email !== null && invitee.email.equals(this.state.email);
    if (!pending || !addressed || !this.state.tokenDigest.matches(presented)) throw new InvitationNotFound();
    this.state = { ...this.state, acceptedAt: now };
    this.record({ type: 'InvitationAccepted', agencyId: this.state.agencyId.value, userId: invitee.userId.value });
  }
}
