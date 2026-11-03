import { z } from 'zod';
import { ACCOUNT_TYPES } from '../../../domain/account-type';
import { emailField, passwordField } from './credential-fields';

export const registerRequest = z.object({ email: emailField, password: passwordField(12), accountType: z.enum(ACCOUNT_TYPES) }).strict();
