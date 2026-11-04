import { singleLine } from './plain-text';

export class LegalName {
  private constructor(readonly value: string) {}

  static of(raw: string): LegalName {
    return new LegalName(singleLine(raw, 'legalName', 2, 200));
  }
}
