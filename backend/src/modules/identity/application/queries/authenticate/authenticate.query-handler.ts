import { Clock } from '../../../../../shared/application/ports/clock';
import { SqlReader } from '../../../../../shared/application/ports/sql-reader';
import { AuthenticationRequired } from '../../../domain/exceptions/identity.exceptions';
import { AccessTokens } from '../../ports/access-tokens';
import { AuthenticatedUser } from './authenticated-user';

const SQL = `
  SELECT users.id, users.email, users.account_type
  FROM sessions
  JOIN users ON users.id = sessions.user_id
  WHERE sessions.id = $1 AND sessions.user_id = $2 AND sessions.revoked_at IS NULL AND sessions.expires_at > $3`;

/** A valid signature is not enough: the session behind the token must still be open. */
export class AuthenticateQueryHandler {
  constructor(private readonly accessTokens: AccessTokens, private readonly reader: SqlReader, private readonly clock: Clock) {}

  async handle(accessToken: string): Promise<AuthenticatedUser> {
    const claims = this.accessTokens.verify(accessToken);
    if (!claims) throw new AuthenticationRequired();
    const [row] = await this.reader.query<{ id: string; email: string | null; account_type: string | null }>(SQL, [claims.sessionId, claims.userId, this.clock.now()]);
    if (!row) throw new AuthenticationRequired();
    return { id: row.id, email: row.email, accountType: row.account_type };
  }
}
