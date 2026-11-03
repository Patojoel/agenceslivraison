import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticateQueryHandler } from '../../application/queries/authenticate/authenticate.query-handler';
import { AuthenticatedUser } from '../../application/queries/authenticate/authenticated-user';
import { AuthenticationRequired } from '../../domain/exceptions/identity.exceptions';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateQueryHandler) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new AuthenticationRequired();
    request.user = await this.authenticate.handle(authorization.slice('Bearer '.length));
    return true;
  }
}
