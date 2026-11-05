import { AgencyPublicView } from './agency-public-view';
import { AgencyNotSubmitted, NoActiveCapability, ProvisionalTradeName, TradeNameNotPublishable } from './exceptions/marketplace.exceptions';
import { PublicSlug } from './value-objects/public-slug';

export type PublicationObstacle = 'agency_not_submitted' | 'provisional_trade_name' | 'trade_name_not_publishable' | 'no_active_capability';

const UNSAFE = /[\p{Cc}\p{Cf}]/u;

/** The name `agencies` gave to the agencies it adopted without one: "Agence", a space, the first 8 characters of the identifier. */
function isProvisional(agencyId: string, tradeName: string): boolean {
  return tradeName === `Agence ${agencyId.slice(0, 8)}`;
}

/**
 * Everything that stops an agency from being shown, in the order the specification reports it. The same list decides
 * whether a profile can be published and whether a published one is visible: a fiche goes back and forth with the agency.
 */
export function obstaclesOf(agencyId: string, view: AgencyPublicView): PublicationObstacle[] {
  const obstacles: PublicationObstacle[] = [];
  if (!view.submitted) obstacles.push('agency_not_submitted');
  if (isProvisional(agencyId, view.tradeName)) obstacles.push('provisional_trade_name');
  else if (UNSAFE.test(view.tradeName) || !PublicSlug.derivable(view.tradeName)) obstacles.push('trade_name_not_publishable');
  if (view.capabilities.length === 0) obstacles.push('no_active_capability');
  return obstacles;
}

export function assertPublishable(agencyId: string, view: AgencyPublicView): void {
  const [first] = obstaclesOf(agencyId, view);
  switch (first) {
    case undefined: return;
    case 'agency_not_submitted': throw new AgencyNotSubmitted();
    case 'provisional_trade_name': throw new ProvisionalTradeName();
    case 'trade_name_not_publishable': throw new TradeNameNotPublishable();
    case 'no_active_capability': throw new NoActiveCapability();
  }
}
