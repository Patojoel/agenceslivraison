import { DomainException } from '@shared/domain/exceptions/domain.exception';

/** Also raised when the actor is not a member, so other agencies stay invisible. */
export class MembershipNotFound extends DomainException {
  constructor() { super('not_found', 'Membership not found'); }
}

export class MembershipForbidden extends DomainException {
  constructor() { super('forbidden', 'Not allowed to manage this membership'); }
}

export class LastOwner extends DomainException {
  constructor() { super('conflict', 'An agency keeps at least one active owner'); }
}

export class AlreadyMember extends DomainException {
  constructor() { super('conflict', 'Already a member of this agency'); }
}

/** Covers unknown, expired, already accepted and addressed-to-someone-else invitations alike. */
export class InvitationNotFound extends DomainException {
  constructor() { super('not_found', 'Invitation not found'); }
}

export class InvalidTradeName extends DomainException {
  constructor() { super('invalid', 'Invalid trade name'); }
}

/** The same idempotency key was already used by this actor for different content. */
export class IdempotencyKeyReused extends DomainException {
  constructor() { super('conflict', 'This idempotency key was already used for another creation'); }
}

/** Unknown agency, or one the caller has no active membership in: both look the same. */
export class AgencyNotFound extends DomainException {
  constructor() { super('not_found', 'Agency not found'); }
}
