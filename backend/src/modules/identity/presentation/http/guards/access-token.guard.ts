import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticateHandler } from '../../../application/queries/authenticate/authenticate.handler';
import { AuthenticatedUser } from '../../../application/read-models/authenticated-user.read-model';
import { AuthenticationRequired } from '../../../domain/exceptions/identity.exceptions';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateHandler) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new AuthenticationRequired();
    request.user = await this.authenticate.handle({ accessToken: authorization.slice('Bearer '.length) });
    return true;
  }
}
