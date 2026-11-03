import { z } from 'zod';
import { emailField, passwordField } from './credential-fields';

export const loginRequest = z.object({ email: emailField, password: passwordField(1) }).strict();
