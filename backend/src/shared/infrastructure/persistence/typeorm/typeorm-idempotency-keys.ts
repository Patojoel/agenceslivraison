import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { IdempotencyClaim, IdempotencyKeys, IdempotencyOutcome } from '../../../application/ports/idempotency-keys.port';
import { TypeOrmDatabaseConnection } from './typeorm-database-connection';

/**
 * Plain SQL on purpose: `ON CONFLICT DO NOTHING` makes a concurrent claimer wait for the first
 * transaction and then fall through to reading its committed outcome.
 */
const CLAIM = `
  INSERT INTO idempotency_keys (actor_id, scope, key, request_hash, resource_id)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (actor_id, scope, key) DO NOTHING
  RETURNING resource_id`;

const EXISTING = 'SELECT request_hash, resource_id FROM idempotency_keys WHERE actor_id = $1 AND scope = $2 AND key = $3';

@Injectable()
export class TypeOrmIdempotencyKeys implements IdempotencyKeys {
  constructor(private readonly connection: TypeOrmDatabaseConnection) {}

  async claim(claim: IdempotencyClaim): Promise<IdempotencyOutcome> {
    const manager = await this.connection.manager();
    const requestHash = createHash('sha256').update(claim.fingerprint).digest('hex');
    const inserted: unknown[] = await manager.query(CLAIM, [claim.actorId, claim.scope, claim.key, requestHash, claim.resourceId]);
    if (inserted.length > 0) return { kind: 'claimed' };
    const [existing]: { request_hash: string; resource_id: string }[] = await manager.query(EXISTING, [claim.actorId, claim.scope, claim.key]);
    if (!existing) throw new Error('Idempotency record vanished while being claimed');
    return existing.request_hash === requestHash ? { kind: 'replayed', resourceId: existing.resource_id } : { kind: 'mismatch' };
  }
}
