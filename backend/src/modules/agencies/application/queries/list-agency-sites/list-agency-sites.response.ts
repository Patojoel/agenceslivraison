import { CursorPage } from '@shared/application/pagination/cursor-page';
import { AgencySiteReadModel } from '../../read-models/agency-site.read-model';

export type ListAgencySitesResponse = CursorPage<AgencySiteReadModel>;
