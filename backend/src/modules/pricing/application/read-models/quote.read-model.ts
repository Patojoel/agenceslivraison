import { QuotePricing, QuoteParcel, QuoteSnapshot, QuoteState } from '../../domain/quote';

/** A quote as stored, dates in ISO form and the status as written (`issued` or `accepted`, never `expired`). */
export interface QuoteRecord {
  readonly id: string;
  readonly reference: string;
  readonly recipientName: string;
  readonly recipientPhone: string | null;
  readonly zoneId: string;
  readonly zoneCity: string;
  readonly zoneDistrict: string | null;
  readonly parcels: readonly QuoteParcel[];
  readonly rateCardVersion: number | null;
  readonly pricing: QuotePricing;
  readonly calculatedTotal: number | null;
  readonly manualPrice: number | null;
  readonly manualPriceReason: string | null;
  readonly total: number;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly validUntil: string;
  readonly status: 'issued' | 'accepted';
  readonly acceptedAt: string | null;
  readonly acceptedBy: string | null;
}

export interface QuoteSummaryRecord {
  readonly id: string;
  readonly reference: string;
  readonly recipientName: string;
  readonly zoneId: string;
  readonly zoneCity: string;
  readonly zoneDistrict: string | null;
  readonly total: number;
  readonly issuedAt: string;
  readonly validUntil: string;
  readonly status: 'issued' | 'accepted';
  readonly acceptedAt: string | null;
}

export interface QuoteReadModel {
  readonly id: string;
  readonly reference: string;
  /** `expired` is derived from the validity date and the clock, never stored. */
  readonly status: QuoteState;
  readonly recipient: { readonly name: string; readonly phone: string | null };
  readonly zone: { readonly id: string; readonly city: string; readonly district: string | null };
  readonly parcels: readonly QuoteParcel[];
  readonly currency: 'XAF';
  /** The version of the rate card the calculation used, `null` for an agency that had none. */
  readonly rateCardVersion: number | null;
  readonly pricing: QuotePricing;
  readonly calculatedTotal: number | null;
  readonly manualPrice: number | null;
  readonly manualPriceReason: string | null;
  readonly total: number;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly validUntil: string;
  readonly acceptedAt: string | null;
  readonly acceptedBy: string | null;
}

export interface QuoteSummaryReadModel {
  readonly id: string;
  readonly reference: string;
  readonly status: QuoteState;
  readonly recipientName: string;
  readonly zone: { readonly id: string; readonly city: string; readonly district: string | null };
  readonly currency: 'XAF';
  readonly total: number;
  readonly issuedAt: string;
  readonly validUntil: string;
  readonly acceptedAt: string | null;
}

export function recordOfQuote(snapshot: QuoteSnapshot): QuoteRecord {
  return {
    id: snapshot.id.value,
    reference: snapshot.reference.value,
    recipientName: snapshot.recipient.name,
    recipientPhone: snapshot.recipient.phone,
    zoneId: snapshot.zone.id.value,
    zoneCity: snapshot.zone.city,
    zoneDistrict: snapshot.zone.district,
    parcels: snapshot.parcels,
    rateCardVersion: snapshot.rateCardVersion,
    pricing: snapshot.pricing,
    calculatedTotal: snapshot.calculatedTotal,
    manualPrice: snapshot.manual?.price ?? null,
    manualPriceReason: snapshot.manual?.reason ?? null,
    total: snapshot.total,
    issuedAt: snapshot.issuedAt.toISOString(),
    issuedBy: snapshot.issuedBy.value,
    validUntil: snapshot.validUntil.toISOString(),
    status: snapshot.status,
    acceptedAt: snapshot.acceptedAt?.toISOString() ?? null,
    acceptedBy: snapshot.acceptedBy?.value ?? null,
  };
}

/** An issued quote whose validity date has passed is expired; the validity date itself is still valid. */
export function stateOf(record: { readonly status: 'issued' | 'accepted'; readonly validUntil: string }, now: Date): QuoteState {
  if (record.status === 'accepted') return 'accepted';
  return now.getTime() > Date.parse(record.validUntil) ? 'expired' : 'issued';
}

export function toQuoteReadModel(record: QuoteRecord, now: Date): QuoteReadModel {
  return {
    id: record.id,
    reference: record.reference,
    status: stateOf(record, now),
    recipient: { name: record.recipientName, phone: record.recipientPhone },
    zone: { id: record.zoneId, city: record.zoneCity, district: record.zoneDistrict },
    parcels: record.parcels,
    currency: 'XAF',
    rateCardVersion: record.rateCardVersion,
    pricing: record.pricing,
    calculatedTotal: record.calculatedTotal,
    manualPrice: record.manualPrice,
    manualPriceReason: record.manualPriceReason,
    total: record.total,
    issuedAt: record.issuedAt,
    issuedBy: record.issuedBy,
    validUntil: record.validUntil,
    acceptedAt: record.acceptedAt,
    acceptedBy: record.acceptedBy,
  };
}

export function toQuoteSummaryReadModel(record: QuoteSummaryRecord, now: Date): QuoteSummaryReadModel {
  return {
    id: record.id,
    reference: record.reference,
    status: stateOf(record, now),
    recipientName: record.recipientName,
    zone: { id: record.zoneId, city: record.zoneCity, district: record.zoneDistrict },
    currency: 'XAF',
    total: record.total,
    issuedAt: record.issuedAt,
    validUntil: record.validUntil,
    acceptedAt: record.acceptedAt,
  };
}
