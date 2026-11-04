import { AgencySite } from '../../domain/agency-site';

export interface AgencySiteReadModel {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly address: string;
  readonly phone: string | null;
  readonly status: 'active' | 'inactive';
  readonly createdAt: string;
  readonly deactivatedAt: string | null;
  readonly version: number;
}

export function toAgencySiteReadModel(site: AgencySite): AgencySiteReadModel {
  return {
    id: site.id.value,
    name: site.name.value,
    city: site.city.value,
    address: site.address.value,
    phone: site.phone?.value ?? null,
    status: site.deactivatedAt === null ? 'active' : 'inactive',
    createdAt: site.createdAt.toISOString(),
    deactivatedAt: site.deactivatedAt?.toISOString() ?? null,
    version: site.version,
  };
}
