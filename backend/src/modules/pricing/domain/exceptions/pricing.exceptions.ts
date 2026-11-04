import { DomainException } from '@shared/domain/exceptions/domain.exception';

/** Names the field only: the refused value is never kept, it may be a figure an agency does not want to see in a log. */
export class InvalidPricingField extends DomainException {
  constructor(readonly field: string) { super('invalid', `Invalid pricing field: ${field}`); }
}

/** Unknown agency, or one the caller has no active membership in: both look the same. */
export class PricingAgencyNotFound extends DomainException {
  constructor() { super('not_found', 'Agency not found'); }
}

/** An active agent knows the agency, so this is a refusal and not a "not found". */
export class PricingForbidden extends DomainException {
  constructor() { super('forbidden', 'Not allowed to change the rate card of this agency'); }
}

export class RateCardNotFound extends DomainException {
  constructor() { super('not_found', 'Rate card not found'); }
}

export class RateCardVersionNotFound extends DomainException {
  constructor() { super('not_found', 'Rate card version not found'); }
}

/** Unknown zone, or one that belongs to another agency: the same answer. */
export class PricingZoneNotFound extends DomainException {
  constructor() { super('not_found', 'Service zone not found'); }
}

export class PricingZoneRetired extends DomainException {
  constructor() { super('conflict', 'This zone is retired', { code: 'ZONE_RETIRED' }); }
}

export class RateCardAlreadyExists extends DomainException {
  constructor() { super('conflict', 'This agency already has a rate card: publish a new version instead', { code: 'RATE_CARD_ALREADY_EXISTS' }); }
}

/** The change was written against a version that is no longer the one in force. */
export class StaleRateCardVersion extends DomainException {
  constructor() { super('conflict', 'The rate card was modified in the meantime', { code: 'STALE_RATE_CARD_VERSION' }); }
}

export class QuoteNotFound extends DomainException {
  constructor() { super('not_found', 'Quote not found'); }
}

/** No price can be calculated for these parcels and no manual price was given. */
export class QuoteNotPriceable extends DomainException {
  constructor() { super('invalid', 'This quote has no price: give a manual price with its reason', { code: 'QUOTE_NOT_PRICEABLE' }); }
}

export class QuoteAlreadyAccepted extends DomainException {
  constructor() { super('conflict', 'This quote was already accepted', { code: 'QUOTE_ALREADY_ACCEPTED' }); }
}

export class QuoteExpired extends DomainException {
  constructor() { super('conflict', 'This quote has expired', { code: 'QUOTE_EXPIRED' }); }
}

/** A suspended (or never activated) delivery capability takes no new commitment. */
export class DeliveryNotActive extends DomainException {
  constructor() { super('conflict', 'The delivery capability of this agency is not active', { code: 'DELIVERY_NOT_ACTIVE' }); }
}

export class QuoteIdempotencyKeyReused extends DomainException {
  constructor() { super('conflict', 'This idempotency key was already used for another quote', { code: 'IDEMPOTENCY_KEY_REUSED' }); }
}
