const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('pg');

(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required and must point to a dedicated empty test database');
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    if (tables.rows.length) throw new Error('Test database must be empty');
    if (process.env.TEST_LEGACY === '1') {
      await client.query('CREATE TABLE schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      await client.query("INSERT INTO schema_migrations (version) VALUES ('0001_initial')");
    }
  } finally { await client.end(); }
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, PORT: '3107', JWT_SECRET: 'test-only-signing-key-0123456789abcdef' };
  const app = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
  try {
    let live;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { live = await fetch('http://127.0.0.1:3107/api/v1/health/live'); break; } catch { await delay(100); }
    }
    assert.equal(live?.status, 200, 'liveness');
    const ready = () => fetch('http://127.0.0.1:3107/api/v1/health/ready');
    const notReady = await ready();
    assert.equal(notReady.status, 503, 'readiness before migration');
    assert.match(notReady.headers.get('content-type'), /^application\/problem\+json/);
    const problem = await notReady.json();
    assert.equal(problem.status, 503);
    assert.equal(problem.code, 'SERVICE_UNAVAILABLE');
    assert.ok(problem.traceId);
    assert.equal((await fetch('http://127.0.0.1:3107/api/v1/docs-json')).status, 503, 'other routes blocked before migration');
    for (let i = 0; i < 2; i++) {
      const migration = spawnSync(process.execPath, ['dist/migrate.js'], { env, stdio: 'inherit' });
      assert.equal(migration.status, 0, 'migration is repeatable');
    }
    assert.equal((await ready()).status, 200, 'readiness after migration');
    const driftClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await driftClient.connect();
    try {
      const saved = await driftClient.query('SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id LIMIT 1');
      await driftClient.query("UPDATE drizzle.__drizzle_migrations SET hash = 'changed' WHERE id = $1", [saved.rows[0].id]);
      assert.equal((await ready()).status, 503, 'readiness rejects migration drift');
      await driftClient.query('UPDATE drizzle.__drizzle_migrations SET hash = $1 WHERE id = $2', [saved.rows[0].hash, saved.rows[0].id]);
      assert.equal((await ready()).status, 200, 'readiness restored');
    } finally { await driftClient.end(); }
    const { Pool } = require('pg');
    const { SessionRepository } = require('../dist/modules/identity/infrastructure/session-repository');
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      const userId = '00000000-0000-4000-8000-000000000001';
      const sessionId = '00000000-0000-4000-8000-000000000002';
      const now = Date.now();
      const original = { id: sessionId, userId, tokenDigest: 'a'.repeat(64), expiresAt: now + 60000, revokedAt: null, version: 1 };
      await pool.query('INSERT INTO users (id) VALUES ($1)', [userId]);
      await pool.query('INSERT INTO sessions (id, user_id, token_digest, expires_at) VALUES ($1, $2, $3, $4)', [sessionId, userId, original.tokenDigest, new Date(original.expiresAt)]);
      const { SessionService } = require('../dist/modules/identity/infrastructure/session-service');
      const service = new SessionService(pool, 60000);
      const issued = await service.issue(userId, now);
      const issuedId = issued.refreshToken.split('.')[0];
      const record = await pool.query('SELECT token_digest FROM sessions WHERE id = $1', [issuedId]);
      assert.ok(!issued.refreshToken.includes(record.rows[0].token_digest), 'raw token is not stored');
      const refreshed = await service.refresh(issued.refreshToken, now + 1);
      assert.ok(refreshed);
      assert.equal(await service.refresh(issued.refreshToken, now + 2), null, 'old refresh token cannot be reused');
      assert.equal(await service.logout(issued.refreshToken, now + 3), false, 'old refresh token cannot log out new session');
      assert.equal(await service.logout(refreshed.refreshToken, now + 4), true);
      assert.equal(await service.refresh(refreshed.refreshToken, now + 5), null, 'logged out session cannot refresh');
      assert.equal(await service.refresh('invalid', now), null);
      const repo = new SessionRepository(pool);
      const outcomes = await Promise.all([
        repo.rotate(original, original.tokenDigest, 'b'.repeat(64), now, now + 120000),
        repo.rotate(original, original.tokenDigest, 'c'.repeat(64), now, now + 120000),
      ]);
      assert.equal(outcomes.filter(Boolean).length, 1, 'exactly one concurrent rotation succeeds');
      assert.equal(await repo.revoke(sessionId, '00000000-0000-4000-8000-000000000003', now), false, 'another user cannot revoke');
      assert.equal(await repo.revoke(sessionId, userId, now), true);
      assert.equal(await repo.rotate(original, original.tokenDigest, 'd'.repeat(64), now, now + 120000), false, 'revoked session cannot rotate');
      const { MembershipRepository, MembershipNotFound, MembershipForbidden } = require('../dist/modules/identity/infrastructure/membership-repository');
      const agencyId = '00000000-0000-4000-8000-000000000010';
      const otherAgency = '00000000-0000-4000-8000-000000000011';
      const secondUser = '00000000-0000-4000-8000-000000000012';
      const ownerOne = '00000000-0000-4000-8000-000000000013';
      const ownerTwo = '00000000-0000-4000-8000-000000000014';
      await pool.query('INSERT INTO users (id) VALUES ($1)', [secondUser]);
      await pool.query('INSERT INTO agencies (id) VALUES ($1), ($2)', [agencyId, otherAgency]);
      await pool.query("INSERT INTO agency_memberships (id, agency_id, user_id, role) VALUES ($1, $3, $4, 'owner'), ($2, $3, $5, 'owner')", [ownerOne, ownerTwo, agencyId, userId, secondUser]);
      const memberships = new MembershipRepository(pool);
      await assert.rejects(memberships.change(userId, otherAgency, ownerTwo, 'agent', false), MembershipNotFound);
      await assert.rejects(memberships.change(userId, agencyId, ownerOne, 'agent', true), MembershipForbidden);
      const concurrent = await Promise.allSettled([
        memberships.change(userId, agencyId, ownerTwo, 'owner', false),
        memberships.change(secondUser, agencyId, ownerOne, 'owner', false),
      ]);
      assert.equal(concurrent.filter(outcome => outcome.status === 'fulfilled').length, 1, 'only one owner removal succeeds');
      const remaining = await pool.query("SELECT count(*)::int AS total FROM agency_memberships WHERE agency_id = $1 AND role = 'owner' AND active", [agencyId]);
      assert.equal(remaining.rows[0].total, 1, 'last owner protected in concurrent updates');
      const audits = await pool.query("SELECT count(*)::int AS total FROM identity_audit WHERE agency_id = $1 AND action = 'membership.removed'", [agencyId]);
      assert.equal(audits.rows[0].total, 1, 'only successful change audited');
    } finally { await pool.end(); }
    const register = (body) => fetch('http://127.0.0.1:3107/api/v1/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const valid = { email: ' Person@Example.com ', password: 'correct horse battery staple', accountType: 'individual' };
    const created = await register(valid);
    assert.equal(created.status, 201, 'registration succeeds');
    const account = await created.json();
    assert.equal(account.accountType, 'individual');
    assert.ok(account.id);
    assert.equal(account.password, undefined);
    assert.equal((await register({ ...valid, email: 'person@example.com' })).status, 409, 'duplicate email is rejected');
    assert.equal((await register({ ...valid, email: 'different@example.com', accountType: 'agency' })).status, 400, 'agency cannot self-register');
    assert.equal((await register({ ...valid, email: 'different@example.com', password: 'short' })).status, 400, 'short password rejected');
    assert.equal((await register({ ...valid, password: 'short' })).status, 400);
    assert.equal((await register(valid)).status, 429, 'registration rate limit enforced');
    const checkPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      const saved = await checkPool.query('SELECT email, password_hash, account_type FROM users WHERE id = $1', [account.id]);
      assert.equal(saved.rows[0].email, 'person@example.com');
      assert.ok(saved.rows[0].password_hash.startsWith('$argon2id$'));
      assert.equal(await require('argon2').verify(saved.rows[0].password_hash, valid.password), true);
      const audit = await checkPool.query("SELECT count(*)::int AS total FROM identity_audit WHERE user_id = $1 AND action = 'user.registered'", [account.id]);
      assert.equal(audit.rows[0].total, 1);
    } finally { await checkPool.end(); }
    const login = (body) => fetch('http://127.0.0.1:3107/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const badLogin = await login({ email: valid.email, password: 'incorrect password' });
    const unknownLogin = await login({ email: 'unknown@example.com', password: 'incorrect password' });
    assert.equal(badLogin.status, 401);
    assert.equal(unknownLogin.status, 401);
    const loggedIn = await login({ email: valid.email, password: valid.password });
    assert.equal(loggedIn.status, 200);
    assert.match(loggedIn.headers.get('cache-control'), /no-store/);
    const tokens = await loggedIn.json();
    assert.equal(tokens.expiresIn, 900);
    const claims = require('jsonwebtoken').verify(tokens.accessToken, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'agenceslivraison', audience: 'agenceslivraison-api' });
    assert.equal(claims.sub, account.id);
    assert.equal(tokens.refreshToken.split('.')[0], claims.sid);
    const creationKey = '00000000-0000-4000-8000-000000000099';
    const createAgency = (key, name, token = tokens.accessToken) => fetch('http://127.0.0.1:3107/api/v1/agencies', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify({ name }) });
    const drafts = await Promise.all([createAgency(creationKey, 'Agence Douala'), createAgency(creationKey, 'Agence Douala')]);
    assert.deepEqual(drafts.map(r => r.status), [201, 201]);
    const draftResults = await Promise.all(drafts.map(r => r.json()));
    assert.equal(draftResults[0].id, draftResults[1].id, 'same request creates only one agency');
    assert.equal(draftResults[0].status, 'draft');
    const onboarding = (agencyId, token = tokens.accessToken) => fetch(`http://127.0.0.1:3107/api/v1/agencies/${agencyId}/onboarding`, { headers: { authorization: `Bearer ${token}` } });
    const currentDraft = await onboarding(draftResults[0].id);
    assert.equal(currentDraft.status, 200);
    assert.deepEqual(await currentDraft.json(), { id: draftResults[0].id, name: 'Agence Douala', status: 'draft' });
    assert.equal((await onboarding('00000000-0000-4000-8000-000000000011')).status, 404, 'foreign agency hidden');
    assert.equal((await onboarding(draftResults[0].id, 'invalid')).status, 401);

    assert.equal((await createAgency(creationKey, 'Autre agence')).status, 409, 'key cannot be reused for different input');
    assert.equal((await createAgency('invalid', 'Agence')).status, 400);
    assert.equal((await createAgency(creationKey, 'Agence', 'invalid')).status, 401);
    const creationPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      const createdMembership = await creationPool.query('SELECT role, user_id FROM agency_memberships WHERE agency_id = $1', [draftResults[0].id]);
      assert.equal(createdMembership.rowCount, 1);
      assert.equal(createdMembership.rows[0].role, 'owner');
      assert.equal(createdMembership.rows[0].user_id, account.id);
      const audit = await creationPool.query("SELECT count(*)::int AS total FROM identity_audit WHERE agency_id = $1 AND action = 'agency.draft_created'", [draftResults[0].id]);
      assert.equal(audit.rows[0].total, 1);
    } finally { await creationPool.end(); }
    const agencyPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const httpAgency = '00000000-0000-4000-8000-000000000020';
    const foreignAgency = '00000000-0000-4000-8000-000000000021';
    const ownerMembership = '00000000-0000-4000-8000-000000000022';
    const targetMembership = '00000000-0000-4000-8000-000000000023';
    try {
      await agencyPool.query('INSERT INTO agencies (id) VALUES ($1), ($2)', [httpAgency, foreignAgency]);
      await agencyPool.query("INSERT INTO agency_memberships (id, agency_id, user_id, role) VALUES ($1, $3, $4, 'owner'), ($2, $3, $5, 'agent')", [ownerMembership, targetMembership, httpAgency, account.id, '00000000-0000-4000-8000-000000000012']);
      const changeMember = (agency, member, access, role) => fetch(`http://127.0.0.1:3107/api/v1/agencies/${agency}/members/${member}`, { method: 'PATCH', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify({ role }) });
      assert.equal((await changeMember(foreignAgency, targetMembership, tokens.accessToken, 'admin')).status, 404, 'other agency hidden');
      assert.equal((await changeMember(httpAgency, ownerMembership, tokens.accessToken, 'admin')).status, 403, 'own role cannot change');
      assert.equal((await changeMember(httpAgency, targetMembership, tokens.accessToken, 'admin')).status, 200, 'owner changes member role');
      const invitedUser = '00000000-0000-4000-8000-000000000024';
      const invitePassword = 'a sufficiently long password';
      const inviteHash = await require('argon2').hash(invitePassword, { type: require('argon2').argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
      await agencyPool.query('INSERT INTO users (id, email, password_hash, account_type) VALUES ($1,$2,$3,$4)', [invitedUser, 'invited@example.com', inviteHash, 'merchant']);
      const createInvite = (agency, access, body) => fetch(`http://127.0.0.1:3107/api/v1/agencies/${agency}/invitations`, { method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const issuedInvite = await createInvite(httpAgency, tokens.accessToken, { email: 'invited@example.com', role: 'agent' });
      assert.equal(issuedInvite.status, 201, 'owner can invite agent');
      const invite = await issuedInvite.json();
      const acceptInvite = (access) => fetch('http://127.0.0.1:3107/api/v1/agency-invitations/accept', { method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify({ token: invite.token }) });
      assert.equal((await acceptInvite(tokens.accessToken)).status, 404, 'wrong email cannot accept');
      const invitedLogin = await login({ email: 'invited@example.com', password: invitePassword });
      assert.equal(invitedLogin.status, 200);
      const invitedTokens = await invitedLogin.json();
      assert.equal((await acceptInvite(invitedTokens.accessToken)).status, 200, 'invited user can accept');
      assert.equal((await acceptInvite(invitedTokens.accessToken)).status, 404, 'invitation cannot be reused');
      assert.equal((await createInvite(httpAgency, invitedTokens.accessToken, { email: 'other@example.com', role: 'agent' })).status, 403, 'agent cannot invite');
      const newMember = await agencyPool.query('SELECT role FROM agency_memberships WHERE agency_id = $1 AND user_id = $2', [httpAgency, invitedUser]);
      assert.equal(newMember.rows[0].role, 'agent');
      const myAgencies = await fetch('http://127.0.0.1:3107/api/v1/me/agencies?limit=1', { headers: { authorization: `Bearer ${invitedTokens.accessToken}` } });
      assert.equal(myAgencies.status, 200);
      const agencyPage = await myAgencies.json();
      assert.deepEqual(agencyPage.items, [{ agencyId: httpAgency, role: 'agent' }]);
      assert.equal(agencyPage.hasMore, false);
      assert.equal((await fetch('http://127.0.0.1:3107/api/v1/me/agencies?limit=101', { headers: { authorization: `Bearer ${invitedTokens.accessToken}` } })).status, 400);

      const saved = await agencyPool.query('SELECT role FROM agency_memberships WHERE id = $1', [targetMembership]);
      assert.equal(saved.rows[0].role, 'admin');
    } finally { await agencyPool.end(); }
    const me = (token) => fetch('http://127.0.0.1:3107/api/v1/me', { headers: { authorization: `Bearer ${token}` } });
    assert.equal((await me(tokens.accessToken)).status, 200, 'valid access token');
    assert.equal((await me('invalid')).status, 401, 'invalid access token');
    const noExpiry = require('jsonwebtoken').sign({ sid: claims.sid }, env.JWT_SECRET, { algorithm: 'HS256', subject: account.id, issuer: 'agenceslivraison', audience: 'agenceslivraison-api' });
    assert.equal((await me(noExpiry)).status, 401, 'tokens without expiration are rejected');
    const mismatched = require('jsonwebtoken').sign({ sid: claims.sid }, env.JWT_SECRET, { algorithm: 'HS256', subject: '00000000-0000-4000-8000-000000000001', expiresIn: 900, issuer: 'agenceslivraison', audience: 'agenceslivraison-api' });
    assert.equal((await me(mismatched)).status, 401, 'session cannot access another user');
    const postToken = (path, token) => fetch(`http://127.0.0.1:3107/api/v1/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) });
    const simultaneous = await Promise.all([postToken('refresh', tokens.refreshToken), postToken('refresh', tokens.refreshToken)]);
    assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 401], 'one concurrent refresh succeeds');
    const replacement = await simultaneous.find(r => r.status === 200).json();
    assert.equal((await postToken('logout', tokens.refreshToken)).status, 401, 'stale token cannot revoke');
    assert.equal((await postToken('logout', replacement.refreshToken)).status, 200);
    assert.equal((await me(replacement.accessToken)).status, 401, 'logout revokes access');
    assert.equal((await postToken('refresh', replacement.refreshToken)).status, 401, 'logout revokes refresh');
    const auditPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      const audit = await auditPool.query("SELECT count(*)::int AS total FROM identity_audit WHERE user_id = $1 AND action = 'session.login'", [account.id]);
      assert.equal(audit.rows[0].total, 1);
    } finally { await auditPool.end(); }
    const openapi = await fetch('http://127.0.0.1:3107/api/v1/docs-json');
    assert.equal(openapi.status, 200);
    const spec = await openapi.json();
    assert.ok(spec.paths['/api/v1/health/ready']);
    assert.ok(spec.paths['/api/v1/auth/register']);
    assert.ok(spec.paths['/api/v1/auth/login']);
    assert.ok(spec.paths['/api/v1/auth/refresh']);
    assert.ok(spec.paths['/api/v1/auth/logout']);
    assert.ok(spec.paths['/api/v1/me']);
    assert.ok(spec.paths['/api/v1/agencies']);
    console.log('E2E: HTTP, PostgreSQL, migrations and OpenAPI passed');
  } finally { app.kill('SIGTERM'); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
