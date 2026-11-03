import { DomainException } from '@shared/domain/exceptions/domain.exception';

export class InvalidPassword extends DomainException {
  constructor() { super('invalid', 'Password does not meet the policy'); }
}

export class EmailAlreadyRegistered extends DomainException {
  constructor() { super('conflict', 'Email already registered'); }
}

export class InvalidCredentials extends DomainException {
  constructor() { super('unauthorized', 'Invalid credentials'); }
}

export class InvalidSession extends DomainException {
  constructor() { super('unauthorized', 'Invalid session'); }
}

export class AuthenticationRequired extends DomainException {
  constructor() { super('unauthorized', 'Authentication required'); }
}
