import { singleLine } from './plain-text';

export class Rccm {
  private constructor(readonly value: string) {}

  static of(raw: string): Rccm {
    return new Rccm(singleLine(raw, 'rccm', 5, 40));
  }
}
