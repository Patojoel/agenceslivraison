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
      const saved = await driftClient.query('SELECT id, name FROM typeorm_migrations ORDER BY id LIMIT 1');
      await driftClient.query("UPDATE typeorm_migrations SET name = 'Changed1793710789928' WHERE id = $1", [saved.rows[0].id]);
      assert.equal((await ready()).status, 503, 'readiness rejects migration drift');
      await driftClient.query('UPDATE typeorm_migrations SET name = $1 WHERE id = $2', [saved.rows[0].name, saved.rows[0].id]);
      assert.equal((await ready()).status, 200, 'readiness restored');
    } finally { await driftClient.end(); }
    const { Pool } = require('pg');
    const jwt = require('jsonwebtoken');
    const api = 'http://127.0.0.1:3107/api/v1';
    const accessFor = (userId, sessionId) => jwt.sign({ sid: sessionId }, env.JWT_SECRET, { algorithm: 'HS256', subject: userId, expiresIn: 900, issuer: 'agenceslivraison', audience: 'agenceslivraison-api' });
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      const userId = '00000000-0000-4000-8000-000000000001';
      const userSession = '00000000-0000-4000-8000-000000000002';
      const secondUser = '00000000-0000-4000-8000-000000000012';
      const secondSession = '00000000-0000-4000-8000-000000000015';
      const agencyId = '00000000-0000-4000-8000-000000000010';
      const otherAgency = '00000000-0000-4000-8000-000000000011';
      const ownerOne = '00000000-0000-4000-8000-000000000013';
      const ownerTwo = '00000000-0000-4000-8000-000000000014';
      await pool.query('INSERT INTO users (id) VALUES ($1), ($2)', [userId, secondUser]);
      await pool.query("INSERT INTO sessions (id, user_id, token_digest, expires_at) VALUES ($1, $2, $3, now() + interval '1 hour'), ($4, $5, $6, now() + interval '1 hour')", [userSession, userId, 'a'.repeat(64), secondSession, secondUser, 'b'.repeat(64)]);
      await pool.query('INSERT INTO agencies (id) VALUES ($1), ($2)', [agencyId, otherAgency]);
      await pool.query("INSERT INTO agency_memberships (id, agency_id, user_id, role) VALUES ($1, $3, $4, 'owner'), ($2, $3, $5, 'owner')", [ownerOne, ownerTwo, agencyId, userId, secondUser]);
      const firstAccess = accessFor(userId, userSession);
      const secondAccess = accessFor(secondUser, secondSession);
      const removeMember = (agency, member, access) => fetch(`${api}/agencies/${agency}/members/${member}`, { method: 'DELETE', headers: { authorization: `Bearer ${access}` } });
      assert.equal((await removeMember(otherAgency, ownerTwo, firstAccess)).status, 404, 'membership in another agency is hidden');
      const selfChange = await fetch(`${api}/agencies/${agencyId}/members/${ownerOne}`, { method: 'PATCH', headers: { authorization: `Bearer ${firstAccess}`, 'content-type': 'application/json' }, body: JSON.stringify({ role: 'agent' }) });
      assert.equal(selfChange.status, 403, 'own role cannot change');
      const concurrent = await Promise.all([removeMember(agencyId, ownerTwo, firstAccess), removeMember(agencyId, ownerOne, secondAccess)]);
      const statuses = concurrent.map(response => response.status).sort();
      assert.equal(statuses[0], 200, 'one owner removal succeeds');
      assert.ok([404, 409].includes(statuses[1]), 'the other owner removal is refused');
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
    const agencyPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const httpAgency = '00000000-0000-4000-8000-000000000020';
    const foreignAgency = '00000000-0000-4000-8000-000000000021';
    const ownerMembership = '00000000-0000-4000-8000-000000000022';
    const targetMembership = '00000000-0000-4000-8000-000000000023';
    try {
      const storedSession = await agencyPool.query("SELECT token_digest, expires_at > now() + interval '29 days' AS long_lived FROM sessions WHERE id = $1", [claims.sid]);
      assert.notEqual(storedSession.rows[0].token_digest, tokens.refreshToken.split('.')[1], 'raw refresh secret is not stored');
      assert.match(storedSession.rows[0].token_digest, /^[a-f0-9]{64}$/);
      assert.equal(storedSession.rows[0].long_lived, true, 'session lasts 30 days');
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
      const inviteTtl = Date.parse(invite.expiresAt) - Date.now();
      assert.ok(inviteTtl > 7 * 86400000 - 60000 && inviteTtl < 7 * 86400000 + 60000, 'invitation lasts seven days');
      const acceptToken = (access, token) => fetch(`${api}/agency-invitations/accept`, { method: 'POST', headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
      const acceptInvite = (access) => acceptToken(access, invite.token);
      assert.equal((await acceptInvite(tokens.accessToken)).status, 404, 'wrong email cannot accept');
      const invitedLogin = await login({ email: 'invited@example.com', password: invitePassword });
      assert.equal(invitedLogin.status, 200);
      const invitedTokens = await invitedLogin.json();
      const accepted = await acceptInvite(invitedTokens.accessToken);
      assert.equal(accepted.status, 200, 'invited user can accept');
      assert.deepEqual(await accepted.json(), { agencyId: httpAgency, role: 'agent' });
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
      const adminAccess = accessFor('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000015');
      assert.equal((await createInvite(httpAgency, adminAccess, { email: 'admin2@example.com', role: 'admin' })).status, 403, 'admin cannot invite admin');
      assert.equal((await createInvite(httpAgency, adminAccess, { email: 'agent2@example.com', role: 'agent' })).status, 201, 'admin can invite agent');
      assert.equal((await changeMember(httpAgency, ownerMembership, adminAccess, 'agent')).status, 403, 'admin cannot manage owner');
      const again = await createInvite(httpAgency, tokens.accessToken, { email: 'invited@example.com', role: 'agent' });
      assert.equal(again.status, 201);
      const againToken = (await again.json()).token;
      assert.equal((await acceptToken(invitedTokens.accessToken, againToken)).status, 409, 'existing member cannot accept again');
      const pending = await agencyPool.query('SELECT accepted_at FROM agency_invitations WHERE id = $1', [againToken.split('.')[0]]);
      assert.equal(pending.rows[0].accepted_at, null, 'refused invitation stays pending');
      assert.equal((await changeMember(httpAgency, targetMembership, tokens.accessToken, 'superuser')).status, 400, 'unknown role rejected');
      assert.equal((await fetch(`${api}/agencies/${httpAgency}/members/not-a-uuid`, { method: 'DELETE', headers: { authorization: `Bearer ${tokens.accessToken}` } })).status, 400, 'invalid member id rejected');
      assert.equal((await fetch(`${api}/agencies/${httpAgency}/members/${targetMembership}`, { method: 'DELETE' })).status, 401, 'anonymous removal rejected');
    } finally { await agencyPool.end(); }
    const me = (token) => fetch('http://127.0.0.1:3107/api/v1/me', { headers: { authorization: `Bearer ${token}` } });
    const profile = await me(tokens.accessToken);
    assert.equal(profile.status, 200, 'valid access token');
    assert.deepEqual(await profile.json(), { id: account.id, email: 'person@example.com', accountType: 'individual' });
    assert.equal((await me('invalid')).status, 401, 'invalid access token');
    const noExpiry = require('jsonwebtoken').sign({ sid: claims.sid }, env.JWT_SECRET, { algorithm: 'HS256', subject: account.id, issuer: 'agenceslivraison', audience: 'agenceslivraison-api' });
    assert.equal((await me(noExpiry)).status, 401, 'tokens without expiration are rejected');
    const mismatched = require('jsonwebtoken').sign({ sid: claims.sid }, env.JWT_SECRET, { algorithm: 'HS256', subject: '00000000-0000-4000-8000-000000000001', expiresIn: 900, issuer: 'agenceslivraison', audience: 'agenceslivraison-api' });
    assert.equal((await me(mismatched)).status, 401, 'session cannot access another user');
    const postToken = (path, token) => fetch(`http://127.0.0.1:3107/api/v1/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) });
    const simultaneous = await Promise.all([postToken('refresh', tokens.refreshToken), postToken('refresh', tokens.refreshToken)]);
    assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 401], 'one concurrent refresh succeeds');
    const replacement = await simultaneous.find(r => r.status === 200).json();
    assert.equal((await postToken('refresh', tokens.refreshToken)).status, 401, 'old refresh token cannot be reused');
    assert.equal((await postToken('logout', tokens.refreshToken)).status, 401, 'stale token cannot revoke');
    assert.equal((await postToken('refresh', 'not-a-token')).status, 400, 'malformed refresh token rejected');
    const loggedOut = await postToken('logout', replacement.refreshToken);
    assert.equal(loggedOut.status, 200);
    assert.deepEqual(await loggedOut.json(), { success: true });
    assert.equal((await me(replacement.accessToken)).status, 401, 'logout revokes access');
    assert.equal((await postToken('refresh', replacement.refreshToken)).status, 401, 'logout revokes refresh');
    const auditPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      const audit = await auditPool.query("SELECT count(*)::int AS total FROM identity_audit WHERE user_id = $1 AND action = 'session.login'", [account.id]);
      assert.equal(audit.rows[0].total, 1);
      const actions = await auditPool.query('SELECT action, count(*)::int AS total FROM identity_audit GROUP BY action ORDER BY action');
      assert.deepEqual(Object.fromEntries(actions.rows.map(row => [row.action, row.total])), {
        'invitation.accepted': 1, 'invitation.created': 3, 'membership.removed': 1, 'membership.role_changed': 1,
        'session.login': 2, 'session.logout': 1, 'session.refresh': 1, 'user.registered': 1,
      }, 'every successful change is audited exactly once');
      const acceptedAudit = await auditPool.query("SELECT user_id, agency_id, subject_user_id FROM identity_audit WHERE action = 'invitation.accepted'");
      assert.deepEqual(acceptedAudit.rows[0], { user_id: '00000000-0000-4000-8000-000000000024', agency_id: httpAgency, subject_user_id: '00000000-0000-4000-8000-000000000024' });
      const roleAudit = await auditPool.query("SELECT user_id, agency_id, subject_user_id FROM identity_audit WHERE action = 'membership.role_changed'");
      assert.deepEqual(roleAudit.rows[0], { user_id: account.id, agency_id: httpAgency, subject_user_id: '00000000-0000-4000-8000-000000000012' });
      const createdAudit = await auditPool.query("SELECT agency_id, subject_user_id FROM identity_audit WHERE action = 'invitation.created' LIMIT 1");
      assert.deepEqual(createdAudit.rows[0], { agency_id: httpAgency, subject_user_id: null });
      const sessionAudit = await auditPool.query("SELECT agency_id, subject_user_id FROM identity_audit WHERE action = 'session.refresh'");
      assert.deepEqual(sessionAudit.rows[0], { agency_id: null, subject_user_id: null });
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
    assert.deepEqual(Object.keys(spec.paths).sort(), [
      '/api/v1/agencies/{agencyId}/invitations', '/api/v1/agencies/{agencyId}/members/{memberId}', '/api/v1/agency-invitations/accept',
      '/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/refresh', '/api/v1/auth/register',
      '/api/v1/health/live', '/api/v1/health/ready', '/api/v1/me', '/api/v1/me/agencies',
    ], 'public route set unchanged');
    const { JWT_SECRET: _unused, ...unsignedEnv } = env;
    const unsigned = spawn(process.execPath, ['dist/main.js'], { env: { ...unsignedEnv, PORT: '3108' }, stdio: 'ignore' });
    try {
      for (let attempt = 0; attempt < 50; attempt++) {
        try { await fetch('http://127.0.0.1:3108/api/v1/health/live'); break; } catch { await delay(100); }
      }
      const unsignedLogin = await fetch('http://127.0.0.1:3108/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'unknown@example.com', password: 'whatever' }) });
      assert.equal(unsignedLogin.status, 503, 'login unavailable without signing key, before checking credentials');
      const unsignedRefresh = await fetch('http://127.0.0.1:3108/api/v1/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: replacement.refreshToken }) });
      assert.equal(unsignedRefresh.status, 503, 'refresh unavailable without signing key');
      assert.equal((await fetch('http://127.0.0.1:3108/api/v1/me', { headers: { authorization: 'Bearer anything' } })).status, 503, 'authentication unavailable without signing key');
    } finally { unsigned.kill('SIGTERM'); }
    console.log('E2E: HTTP, PostgreSQL, migrations and OpenAPI passed');
  } finally { app.kill('SIGTERM'); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
