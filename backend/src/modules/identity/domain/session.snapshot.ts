import { TokenDigest } from '@shared/domain/value-objects/token-digest';
import { UserId } from '@shared/domain/value-objects/user-id';
import { SessionId } from './value-objects/session-id';

export interface SessionSnapshot {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly tokenDigest: TokenDigest;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly version: number;
}
