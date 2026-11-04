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

/** Names the field only: the refused value is never kept, it may be personal data. */
export class InvalidAgencyField extends DomainException {
  constructor(readonly field: string) { super('invalid', `Invalid agency field: ${field}`); }
}

export class AgencyIdentityLocked extends DomainException {
  constructor() { super('conflict', 'The identity of a submitted agency can no longer be modified'); }
}

/** The change was written against a version that is no longer the current one. */
export class StaleAgencyVersion extends DomainException {
  constructor() { super('conflict', 'The agency was modified in the meantime'); }
}

export class AgencyEditForbidden extends DomainException {
  constructor() { super('forbidden', 'Not allowed to edit this agency'); }
}
