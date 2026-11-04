import { PricingAgencyNotFound, PricingForbidden } from '../domain/exceptions/pricing.exceptions';
import { AgencyAccess, DeliveryAgencyState, MemberRole } from './ports/agency-access.port';
import { ZoneDirectory } from '../domain/zone-directory';

/** An outsider, a former member and an unknown agency see "not found"; a member whose role lacks the right is forbidden. */
export async function requireRole(access: AgencyAccess, agencyId: string, userId: string, allows: (role: MemberRole) => boolean): Promise<void> {
  const role = await access.activeRoleOf(agencyId, userId);
  if (role === null) throw new PricingAgencyNotFound();
  if (!allows(role)) throw new PricingForbidden();
}

/**
 * The protocol of every write: the role is checked without any lock, so that nobody refused can hold up the agency, then
 * the agency is locked in shared mode (a zone cannot be retired meanwhile) and the role is decided again, as it may have
 * changed while waiting.
 */
export async function lockAgencyForWrite(access: AgencyAccess, agencyId: string, userId: string, allows: (role: MemberRole) => boolean): Promise<DeliveryAgencyState> {
  await requireRole(access, agencyId, userId, allows);
  const state = await access.deliveryStateLockedShared(agencyId);
  await requireRole(access, agencyId, userId, allows);
  return state;
}

export function zoneDirectoryOf(state: DeliveryAgencyState): ZoneDirectory {
  const statuses = new Map(state.zones.map(zone => [zone.id, zone.active ? 'active' as const : 'retired' as const]));
  return { statusOf: zoneId => statuses.get(zoneId) ?? 'unknown' };
}
