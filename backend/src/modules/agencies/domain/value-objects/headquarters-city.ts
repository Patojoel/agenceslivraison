import { singleLine } from './plain-text';

export class HeadquartersCity {
  private constructor(readonly value: string) {}

  static of(raw: string): HeadquartersCity {
    return new HeadquartersCity(singleLine(raw, 'headquartersCity', 2, 80));
  }
}
