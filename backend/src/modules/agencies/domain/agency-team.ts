import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UserId } from '@shared/domain/value-objects/user-id';
import { AgencyRole, InvitationRole } from './agency-role';
import { AgencyEvent } from './events/agency-events';
import { AgencyEditForbidden, AgencySubmissionForbidden, AlreadyMember, LastOwner, MembershipForbidden, MembershipNotFound } from './exceptions/agency.exceptions';
import { AgencyId } from './value-objects/agency-id';
import { MembershipId } from './value-objects/membership-id';

export interface Membership {
  readonly id: MembershipId;
  readonly userId: UserId;
  readonly role: AgencyRole;
  readonly active: boolean;
}

/** The agency and all its memberships, active or not: the unit that guards the team rules. */
export class AgencyTeam extends AggregateRoot<AgencyEvent> {
  private constructor(readonly agencyId: AgencyId, private memberships: readonly Membership[]) {
    super();
  }

  /** The creator of an agency is its first owner: an agency never exists without one. */
  static found(agencyId: AgencyId, membershipId: MembershipId, ownerId: UserId): AgencyTeam {
    return new AgencyTeam(agencyId, [{ id: membershipId, userId: ownerId, role: 'owner', active: true }]);
  }

  static reconstitute(agencyId: AgencyId, memberships: readonly Membership[]): AgencyTeam {
    return new AgencyTeam(agencyId, memberships);
  }

  snapshot(): readonly Membership[] {
    return this.memberships;
  }

  authorizeInvitation(actorId: UserId, role: InvitationRole): void {
    const actor = this.activeMemberByUser(actorId);
    if (actor.role !== 'owner' && !(actor.role === 'admin' && role === 'agent')) throw new MembershipForbidden();
  }

  /** Identity and profile are managed by owners and administrators; an agent only reads. */
  authorizeAgencyEdition(actorId: UserId): void {
    if (this.activeMemberByUser(actorId).role === 'agent') throw new AgencyEditForbidden();
  }

  /** Only an owner submits the agency: a recipient of the other roles is told so, an outsider sees nothing. */
  authorizeAgencySubmission(actorId: UserId): void {
    if (this.activeMemberByUser(actorId).role !== 'owner') throw new AgencySubmissionForbidden();
  }

  changeRole(actorId: UserId, membershipId: MembershipId, role: AgencyRole): void {
    const actor = this.activeMemberByUser(actorId);
    const target = this.activeMembership(membershipId);
    this.authorizeManagement(actor, target, role);
    if (role !== 'owner') this.protectLastOwner(target);
    this.replace({ ...target, role });
    this.record({ type: 'MembershipRoleChanged', agencyId: this.agencyId.value, actorId: actorId.value, subjectUserId: target.userId.value });
  }

  revoke(actorId: UserId, membershipId: MembershipId): void {
    const actor = this.activeMemberByUser(actorId);
    const target = this.activeMembership(membershipId);
    this.authorizeManagement(actor, target, target.role);
    this.protectLastOwner(target);
    this.replace({ ...target, active: false });
    this.record({ type: 'MembershipRevoked', agencyId: this.agencyId.value, actorId: actorId.value, subjectUserId: target.userId.value });
  }

  /** A former member, even deactivated, cannot come back through an invitation. */
  admit(membershipId: MembershipId, userId: UserId, role: InvitationRole): void {
    if (this.memberships.some(membership => membership.userId.equals(userId))) throw new AlreadyMember();
    this.memberships = [...this.memberships, { id: membershipId, userId, role, active: true }];
  }

  private activeMemberByUser(userId: UserId): Membership {
    const membership = this.memberships.find(item => item.active && item.userId.equals(userId));
    if (!membership) throw new MembershipNotFound();
    return membership;
  }

  private activeMembership(id: MembershipId): Membership {
    const membership = this.memberships.find(item => item.active && item.id.equals(id));
    if (!membership) throw new MembershipNotFound();
    return membership;
  }

  /** Nobody manages their own access; an owner manages anyone, an admin only agents and only as agents. */
  private authorizeManagement(actor: Membership, target: Membership, nextRole: AgencyRole): void {
    if (actor.userId.equals(target.userId)) throw new MembershipForbidden();
    if (actor.role === 'owner') return;
    if (actor.role === 'admin' && target.role === 'agent' && nextRole === 'agent') return;
    throw new MembershipForbidden();
  }

  private protectLastOwner(target: Membership): void {
    if (target.role !== 'owner') return;
    const activeOwners = this.memberships.filter(item => item.active && item.role === 'owner').length;
    if (activeOwners <= 1) throw new LastOwner();
  }

  private replace(next: Membership): void {
    this.memberships = this.memberships.map(item => (item.id.equals(next.id) ? next : item));
  }
}
