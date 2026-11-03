import { randomUUID } from 'node:crypto';
import { UuidGenerator } from '../../domain/ports/uuid-generator.port';

export class CryptoUuidGenerator implements UuidGenerator {
  generate(): string {
    return randomUUID();
  }
}
