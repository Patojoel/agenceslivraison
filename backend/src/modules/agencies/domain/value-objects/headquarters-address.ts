import { singleLine } from './plain-text';

export class HeadquartersAddress {
  private constructor(readonly value: string) {}

  static of(raw: string): HeadquartersAddress {
    return new HeadquartersAddress(singleLine(raw, 'headquartersAddress', 5, 300));
  }
}
