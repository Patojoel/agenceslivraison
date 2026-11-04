export type DomainExceptionKind = 'invalid' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict';

/** What a client may rely on besides the status: a stable code, and for some refusals the names of what is missing. */
export interface ProblemExtras {
  readonly code: string;
  readonly missing?: readonly string[];
}

export abstract class DomainException extends Error {
  protected constructor(readonly kind: DomainExceptionKind, message: string, readonly extras?: ProblemExtras) {
    super(message);
    this.name = new.target.name;
  }
}
