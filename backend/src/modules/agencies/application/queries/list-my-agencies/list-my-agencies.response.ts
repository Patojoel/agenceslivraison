import { CursorPage } from '@shared/application/pagination/cursor-page';
import { MyAgencyReadModel } from '../../read-models/my-agency.read-model';

export type ListMyAgenciesResponse = CursorPage<MyAgencyReadModel>;
