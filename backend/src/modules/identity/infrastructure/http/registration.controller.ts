import { BadRequestException, Body, Header, ConflictException, Controller, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { Pool } from 'pg';
import { z } from 'zod';
import { DATABASE_POOL } from '../../../../shared/infrastructure/db/create-pool';

const inputSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 256),
  accountType: z.enum(['individual', 'merchant']),
}).strict();

@ApiTags('auth')
@Controller('auth')
export class RegistrationController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  @Post('register')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({ schema: { type: 'object', required: ['email', 'password', 'accountType'], properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 12, maxLength: 128, format: 'password', writeOnly: true },
    accountType: { type: 'string', enum: ['individual', 'merchant'] },
  } } })
  @ApiCreatedResponse({ schema: { type: 'object', required: ['id', 'accountType'], properties: { id: { type: 'string', format: 'uuid' }, accountType: { type: 'string', enum: ['individual', 'merchant'] } } } })
  async register(@Body() body: unknown): Promise<{ id: string; accountType: 'individual' | 'merchant' }> {
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const { email, password, accountType } = parsed.data;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO users (id, email, password_hash, account_type) VALUES ($1, $2, $3, $4)', [id, email, passwordHash, accountType]);
      await client.query('INSERT INTO identity_audit (id, user_id, action) VALUES ($1, $2, $3)', [randomUUID(), id, 'user.registered']);
      await client.query('COMMIT');
      return { id, accountType };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof Error && 'code' in error && error.code === '23505') throw new ConflictException();
      throw error;
    } finally { client.release(); }
  }
}
