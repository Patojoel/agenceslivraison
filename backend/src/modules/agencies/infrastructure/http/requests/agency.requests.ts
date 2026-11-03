import { z } from 'zod';
import { AGENCY_ROLES, INVITATION_ROLES } from '../../../domain/agency-role';

export const changeMemberRoleRequest = z.object({ role: z.enum(AGENCY_ROLES) }).strict();

export const issueInvitationRequest = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  role: z.enum(INVITATION_ROLES),
}).strict();

export const acceptInvitationRequest = z.object({
  token: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/),
}).strict();
