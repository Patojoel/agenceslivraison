export type DomainExceptionKind = 'invalid' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict';

export abstract class DomainException extends Error {
  protected constructor(readonly kind: DomainExceptionKind, message: string) {
    super(message);
    this.name = new.target.name;
  }
}
