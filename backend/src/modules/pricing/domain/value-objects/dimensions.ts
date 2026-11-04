import { InvalidPricingField } from '../exceptions/pricing.exceptions';

const isCentimetres = (value: number): boolean => Number.isSafeInteger(value) && value >= 1 && value <= 500;

/** Length, width and height of a parcel in whole centimetres. */
export class Dimensions {
  private constructor(readonly length: number, readonly width: number, readonly height: number) {}

  static of(length: number, width: number, height: number): Dimensions {
    if (![length, width, height].every(isCentimetres)) throw new InvalidPricingField('dimensions');
    return new Dimensions(length, width, height);
  }

  /** In cubic centimetres: at most 125 000 000, so exact as an integer. */
  get volume(): number {
    return this.length * this.width * this.height;
  }
}
