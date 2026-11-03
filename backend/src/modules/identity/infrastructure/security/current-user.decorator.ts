import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../application/queries/authenticate/authenticated-user';
import { AuthenticationRequired } from '../../domain/exceptions/identity.exceptions';
import { AuthenticatedRequest } from './access-token.guard';

/** Only valid on routes protected by AccessTokenGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new AuthenticationRequired();
  return user;
});
