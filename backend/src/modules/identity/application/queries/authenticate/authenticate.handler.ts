import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '@shared/domain/ports/clock.port';
import { AuthenticationRequired } from '../../../domain/exceptions/identity.exceptions';
import { ACCESS_TOKENS, AccessTokens } from '../../ports/access-tokens.port';
import { READ_SESSION_REPOSITORY, ReadSessionRepository } from '../../ports/read-session.repository';
import { AuthenticatedUser } from '../../read-models/authenticated-user.read-model';
import { AuthenticateQuery } from './authenticate.query';

/** A valid signature is not enough: the session behind the token must still be open. */
@Injectable()
export class AuthenticateHandler {
  constructor(
    @Inject(ACCESS_TOKENS) private readonly accessTokens: AccessTokens,
    @Inject(READ_SESSION_REPOSITORY) private readonly sessions: ReadSessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle(query: AuthenticateQuery): Promise<AuthenticatedUser> {
    const claims = this.accessTokens.verify(query.accessToken);
    if (!claims) throw new AuthenticationRequired();
    const user = await this.sessions.findOpenSessionUser({ sessionId: claims.sessionId, userId: claims.userId, now: this.clock.now() });
    if (!user) throw new AuthenticationRequired();
    return user;
  }
}
