import { ServiceZone } from '../../domain/service-zone';

export interface ServiceZoneReadModel {
  readonly id: string;
  readonly city: string;
  readonly district: string | null;
  readonly status: 'active' | 'retired';
  readonly addedAt: string;
  readonly retiredAt: string | null;
}

export function toServiceZoneReadModel(zone: ServiceZone): ServiceZoneReadModel {
  return {
    id: zone.id.value,
    city: zone.area.city,
    district: zone.area.district,
    status: zone.retiredAt === null ? 'active' : 'retired',
    addedAt: zone.addedAt.toISOString(),
    retiredAt: zone.retiredAt?.toISOString() ?? null,
  };
}
