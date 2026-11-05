/**
 * Public API of `pricing` for the modules that react to what happens to a rate card (marketplace first): the events of its
 * domain and their guard, next to `PublicPricingReader`. Other modules import them from here and from nowhere else in the
 * domain of `pricing`.
 */
export { isPricingEvent } from '../../../domain/events/pricing-events';
export type { PricingEvent } from '../../../domain/events/pricing-events';
