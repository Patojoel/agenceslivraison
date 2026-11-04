import { z } from 'zod';
import { CAPABILITY_TYPES } from '../../../domain/capability';

export const capabilityTypeParam = z.enum(CAPABILITY_TYPES);

export const suspendCapabilityRequest = z.object({ reason: z.string() }).strict();

/** Enabling a capability takes no body: an absent one and an empty object are the same thing. */
export const noBody = z.object({}).strict().optional();
