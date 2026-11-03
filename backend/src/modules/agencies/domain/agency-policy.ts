export type AgencyRole = 'owner' | 'admin' | 'agent';
/** Conservative initial policy; agency membership must be verified separately. */
export function canManageMembership(actor: AgencyRole, target: AgencyRole, next: AgencyRole, isSelf: boolean): boolean {
  if (isSelf) return false;
  if (actor === 'owner') return true;
  return actor === 'admin' && target === 'agent' && next === 'agent';
}
