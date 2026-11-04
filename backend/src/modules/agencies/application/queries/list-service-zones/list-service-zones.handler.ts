import { Inject, Injectable } from '@nestjs/common';
import { buildCursorPage } from '@shared/application/pagination/cursor-page';
import { AgencyNotFound } from '../../../domain/exceptions/agency.exceptions';
import { READ_SERVICE_ZONE_REPOSITORY, ReadServiceZoneRepository } from '../../ports/read-service-zone.repository';
import { ListServiceZonesQuery } from './list-service-zones.query';
import { ListServiceZonesResponse } from './list-service-zones.response';

@Injectable()
export class ListServiceZonesHandler {
  constructor(@Inject(READ_SERVICE_ZONE_REPOSITORY) private readonly zones: ReadServiceZoneRepository) {}

  async handle(query: ListServiceZonesQuery): Promise<ListServiceZonesResponse> {
    const rows = await this.zones.listForMember({ agencyId: query.agencyId, userId: query.userId, after: query.cursor, limit: query.limit + 1 });
    if (rows === null) throw new AgencyNotFound();
    return buildCursorPage(rows, query.limit, zone => zone.id);
  }
}
