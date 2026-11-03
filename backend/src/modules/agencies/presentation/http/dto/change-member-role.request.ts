import { z } from 'zod';
import { AGENCY_ROLES } from '../../../domain/agency-role';

export const changeMemberRoleRequest = z.object({ role: z.enum(AGENCY_ROLES) }).strict();
