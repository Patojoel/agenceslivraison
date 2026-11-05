import { DomainException } from '@shared/domain/exceptions/domain.exception';

export class InvalidPublicSlug extends DomainException {
  constructor() { super('invalid', 'Invalid public slug'); }
}

/** Unknown agency, or one the caller has no active membership in: both look the same. */
export class MarketplaceAgencyNotFound extends DomainException {
  constructor() { super('not_found', 'Agency not found'); }
}

/** An active administrator or agent knows the agency, so this is a refusal and not a "not found". */
export class MarketplaceForbidden extends DomainException {
  constructor() { super('forbidden', 'Only the owner of the agency publishes or withdraws its public profile'); }
}

export class AgencyNotSubmitted extends DomainException {
  constructor() { super('conflict', 'The agency must be submitted before its profile is published', { code: 'AGENCY_NOT_SUBMITTED' }); }
}

export class ProvisionalTradeName extends DomainException {
  constructor() { super('conflict', 'The agency still has its provisional trade name: change it before publishing', { code: 'PROVISIONAL_TRADE_NAME' }); }
}

/** The state of the agency, not the request, is at fault: a control or format character, or no address can be made of the name. */
export class TradeNameNotPublishable extends DomainException {
  constructor() { super('conflict', 'The trade name of the agency cannot be published', { code: 'TRADE_NAME_NOT_PUBLISHABLE' }); }
}

export class NoActiveCapability extends DomainException {
  constructor() { super('conflict', 'The agency has no active capability', { code: 'NO_ACTIVE_CAPABILITY' }); }
}

export class ProfileAlreadyPublished extends DomainException {
  constructor() { super('conflict', 'The public profile is already published', { code: 'PROFILE_ALREADY_PUBLISHED' }); }
}

export class ProfileNotPublished extends DomainException {
  constructor() { super('conflict', 'The public profile is not published', { code: 'PROFILE_NOT_PUBLISHED' }); }
}

/** Every address tried was taken: only a flood of agencies with one name gets here. */
export class PublicSlugUnavailable extends DomainException {
  constructor() { super('conflict', 'No public address is available for this name', { code: 'PUBLIC_SLUG_UNAVAILABLE' }); }
}
