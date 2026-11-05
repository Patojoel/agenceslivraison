import { AgencyPublicView } from '../domain/agency-public-view';
import { MarketplaceAgencyNotFound, MarketplaceForbidden } from '../domain/exceptions/marketplace.exceptions';
import { AgencyAccess, MemberRole } from './ports/agency-access.port';

/** An outsider, a former member and an unknown agency see "not found"; a member whose role lacks the right is forbidden. */
export async function requireRole(access: AgencyAccess, agencyId: string, userId: string, allows: (role: MemberRole) => boolean): Promise<void> {
  const role = await access.activeRoleOf(agencyId, userId);
  if (role === null) throw new MarketplaceAgencyNotFound();
  if (!allows(role)) throw new MarketplaceForbidden();
}

/**
 * The protocol of every write: the role is checked without any lock, so that nobody refused can hold up the agency, then
 * the agency is locked in shared mode (a capability cannot be suspended meanwhile) and the role is decided again, as it may
 * have changed while waiting. Answers what the agency says of itself under that lock.
 */
export async function lockAgencyForWrite(access: AgencyAccess, agencyId: string, userId: string, allows: (role: MemberRole) => boolean): Promise<AgencyPublicView> {
  await requireRole(access, agencyId, userId, allows);
  const view = await access.publicViewOfLockedShared(agencyId);
  await requireRole(access, agencyId, userId, allows);
  if (view === null) throw new MarketplaceAgencyNotFound();
  return view;
}
