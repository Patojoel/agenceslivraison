import { CursorPage } from '@shared/application/pagination/cursor-page';
import { ServiceZoneReadModel } from '../../read-models/service-zone.read-model';

export type ListServiceZonesResponse = CursorPage<ServiceZoneReadModel>;
