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

/** Only an owner submits the agency; the other roles know the agency, so this is a refusal, not a "not found". */
export class AgencySubmissionForbidden extends DomainException {
  constructor() { super('forbidden', 'Only an owner may submit this agency'); }
}

export class AgencyAlreadySubmitted extends DomainException {
  constructor() { super('conflict', 'This agency is already submitted for verification', { code: 'AGENCY_ALREADY_SUBMITTED' }); }
}

/** Lists every prerequisite that is not met, by code (see `onboarding-requirements`), and nothing else. */
export class SubmissionIncomplete extends DomainException {
  constructor(readonly missing: readonly string[]) {
    super('invalid', 'The agency file is incomplete', { code: 'SUBMISSION_INCOMPLETE', missing });
  }
}

export class AgencyEditForbidden extends DomainException {
  constructor() { super('forbidden', 'Not allowed to edit this agency'); }
}

/** Unknown zone, or one that belongs to another agency: the same answer. */
export class ServiceZoneNotFound extends DomainException {
  constructor() { super('not_found', 'Service zone not found'); }
}

export class ServiceZoneAlreadyServed extends DomainException {
  constructor() { super('conflict', 'This zone is already served', { code: 'ZONE_ALREADY_SERVED' }); }
}

export class ServiceZoneLimitReached extends DomainException {
  constructor() { super('conflict', 'The maximum number of active zones is reached', { code: 'ZONE_LIMIT_REACHED' }); }
}

export class ServiceZoneAlreadyRetired extends DomainException {
  constructor() { super('conflict', 'This zone is already retired', { code: 'ZONE_ALREADY_RETIRED' }); }
}

export class LastActiveZone extends DomainException {
  constructor() { super('conflict', 'Delivery needs at least one active zone', { code: 'LAST_ACTIVE_ZONE' }); }
}

/** Unknown site, or one that belongs to another agency: the same answer. */
export class AgencySiteNotFound extends DomainException {
  constructor() { super('not_found', 'Site not found'); }
}

export class SiteNameTaken extends DomainException {
  constructor() { super('conflict', 'An active site already has this name', { code: 'SITE_NAME_TAKEN' }); }
}

export class SiteDeactivated extends DomainException {
  constructor() { super('conflict', 'This site is deactivated', { code: 'SITE_DEACTIVATED' }); }
}

export class SiteAlreadyActive extends DomainException {
  constructor() { super('conflict', 'This site is already active', { code: 'SITE_ALREADY_ACTIVE' }); }
}

export class LastActiveSite extends DomainException {
  constructor() { super('conflict', 'Storage needs at least one active site', { code: 'LAST_ACTIVE_SITE' }); }
}

/** The change was written against a site version that is no longer the current one. */
export class StaleSiteVersion extends DomainException {
  constructor() { super('conflict', 'The site was modified in the meantime', { code: 'STALE_SITE_VERSION' }); }
}

export class CapabilityAlreadyActive extends DomainException {
  constructor() { super('conflict', 'This capability is already active', { code: 'CAPABILITY_ALREADY_ACTIVE' }); }
}

export class CapabilityNotActive extends DomainException {
  constructor() { super('conflict', 'This capability is not active', { code: 'CAPABILITY_NOT_ACTIVE' }); }
}

/** Names what is missing (`active_zone`, `active_site`), nothing else. */
export class CapabilityPrerequisiteMissing extends DomainException {
  constructor(readonly missing: readonly string[]) {
    super('invalid', 'The minimal configuration of this capability is incomplete', { code: 'CAPABILITY_PREREQUISITE_MISSING', missing });
  }
}
