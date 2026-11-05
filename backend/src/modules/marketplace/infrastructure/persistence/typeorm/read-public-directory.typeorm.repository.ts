import { Injectable } from '@nestjs/common';
import { TypeOrmDatabaseConnection } from '@shared/infrastructure/persistence/typeorm/typeorm-database-connection';
import { PublicCapability } from '../../../domain/agency-public-view';
import { PublicCursorPosition } from '../../../domain/value-objects/public-cursor';
import { PublicSearchCriteria } from '../../../domain/value-objects/public-search-criteria';
import { PublicDirectoryRecord, PublicZoneRecord, ReadPublicDirectoryRepository } from '../../../application/ports/read-public-directory.repository';

interface ListingRow {
  slug: string;
  name: string;
  name_key: string;
  description: string | null;
  verification: string;
  capabilities: string[];
  zones: unknown;
  site_cities: string[];
  published_at: Date;
}

/** The closed list of columns: never `*`, never the identifier of the agency or a search key. */
const COLUMNS = 'slug, name, name_key, description, verification, capabilities, zones, site_cities, published_at';
const ORDER = 'ORDER BY name_key, slug';

/** The `%`, `_` and `\` of what the visitor typed are letters, not wildcards. */
function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

function isCapability(value: string): value is PublicCapability {
  return value === 'delivery' || value === 'storage';
}

function zonesOf(raw: unknown): PublicZoneRecord[] {
  if (!Array.isArray(raw)) return [];
  const zones: PublicZoneRecord[] = [];
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { city, district, startingPrice } = item as Record<string, unknown>;
    if (typeof city !== 'string') continue;
    zones.push({
      city,
      district: typeof district === 'string' ? district : null,
      startingPrice: typeof startingPrice === 'number' ? startingPrice : null,
    });
  }
  return zones;
}

function recordOf(row: ListingRow): PublicDirectoryRecord {
  return {
    slug: row.slug,
    name: row.name,
    nameKey: row.name_key,
    description: row.description,
    verification: 'unverified',
    capabilities: row.capabilities.filter(isCapability),
    zones: zonesOf(row.zones),
    siteCities: row.site_cities,
    publishedAt: row.published_at,
  };
}

/**
 * The fixed fragments below are the only SQL text; every value a visitor sends travels as a numbered parameter. The
 * conditions rest on the keys of the projection (`city_keys`, `district_keys`, already in comparison form) and on its
 * order index `(name_key, slug) WHERE visible`, so the page is read from the index in order and stops at the limit.
 */
@Injectable()
export class ReadPublicDirectoryTypeOrmRepository implements ReadPublicDirectoryRepository {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async search(criteria: PublicSearchCriteria, after: PublicCursorPosition | null, take: number): Promise<PublicDirectoryRecord[]> {
    const conditions: string[] = ['visible'];
    const parameters: unknown[] = [];
    const bind = (value: unknown, type: string): string => {
      parameters.push(value);
      return `$${parameters.length}::${type}`;
    };
    if (criteria.nameContains !== null) conditions.push(`name_key LIKE ${bind(containsPattern(criteria.nameContains), 'text')} ESCAPE '\\'`);
    if (criteria.cityKey !== null) conditions.push(`city_keys @> ARRAY[${bind(criteria.cityKey, 'text')}]`);
    const districtKeys = criteria.districtAreaKeys;
    if (districtKeys !== null) conditions.push(`district_keys && ${bind([...districtKeys], 'text[]')}`);
    if (criteria.capabilities.length > 0) conditions.push(`capabilities @> ${bind([...criteria.capabilities], 'text[]')}`);
    if (after !== null) conditions.push(`(name_key, slug) > (${bind(after.nameKey, 'text')}, ${bind(after.slug, 'text')})`);
    const limit = bind(take, 'int');
    const manager = await this.connection.manager();
    const rows: ListingRow[] = await manager.query(`SELECT ${COLUMNS} FROM public_agency_listings WHERE ${conditions.join(' AND ')} ${ORDER} LIMIT ${limit}`, parameters);
    return rows.map(recordOf);
  }

  async findVisibleBySlug(slug: string): Promise<PublicDirectoryRecord | null> {
    const manager = await this.connection.manager();
    const rows: ListingRow[] = await manager.query(`SELECT ${COLUMNS} FROM public_agency_listings WHERE slug = $1::text AND visible`, [slug]);
    const row = rows[0];
    return row === undefined ? null : recordOf(row);
  }
}
