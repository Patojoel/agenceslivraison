import { DomainException } from '../domain-exception';

export class InvalidEmail extends DomainException {
  constructor() { super('invalid', 'Invalid email'); }
}

export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (value.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(value)) throw new InvalidEmail();
    return new Email(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
