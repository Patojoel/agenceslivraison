/** Pure membership invariants. Callers must authorize the actor and serialize owner changes. */
export interface Membership {
  readonly userId: string;
  readonly agencyId: string;
  readonly role: string;
  readonly permissions: readonly string[];
  readonly active: boolean;
}

export class MembershipRuleError extends Error {}

export function selectAgency(userId: string, agencyId: string, memberships: readonly Membership[]): Membership {
  const membership = memberships.find(item => item.userId === userId && item.agencyId === agencyId && item.active);
  if (!membership) throw new MembershipRuleError('Active membership required');
  return membership;
}

function protectLastOwner(current: Membership, next: Membership, memberships: readonly Membership[]): void {
  if (current.active && current.role === 'owner' && (!next.active || next.role !== 'owner')) {
    const anotherOwner = memberships.some(item => item.agencyId === current.agencyId && item.userId !== current.userId && item.active && item.role === 'owner');
    if (!anotherOwner) throw new MembershipRuleError('Cannot remove the last owner');
  }
}

export function changeMembership(actorId: string, current: Membership, next: Membership, memberships: readonly Membership[]): Membership {
  if (current.userId !== next.userId || current.agencyId !== next.agencyId) throw new MembershipRuleError('Membership identity cannot change');
  if (actorId === current.userId && (current.role !== next.role || (!current.active && next.active) || next.permissions.some(permission => !current.permissions.includes(permission)))) {
    throw new MembershipRuleError('Cannot change own role or grant self permissions');
  }
  protectLastOwner(current, next, memberships);
  return { ...next, permissions: [...next.permissions] };
}

export function removeMembership(current: Membership, memberships: readonly Membership[]): Membership {
  const next = { ...current, active: false };
  protectLastOwner(current, next, memberships);
  return next;
}
