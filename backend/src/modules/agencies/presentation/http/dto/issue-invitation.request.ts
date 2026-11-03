import { z } from 'zod';
import { INVITATION_ROLES } from '../../../domain/agency-role';

export const issueInvitationRequest = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  role: z.enum(INVITATION_ROLES),
}).strict();
