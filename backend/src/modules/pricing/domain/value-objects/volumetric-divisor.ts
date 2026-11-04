import { InvalidPricingField } from '../exceptions/pricing.exceptions';

/** Cubic centimetres per kilogram of volumetric weight. */
export class VolumetricDivisor {
  private constructor(readonly value: number) {}

  static of(value: number): VolumetricDivisor {
    if (!Number.isSafeInteger(value) || value < 1000 || value > 10_000) throw new InvalidPricingField('volumetricDivisor');
    return new VolumetricDivisor(value);
  }
}
