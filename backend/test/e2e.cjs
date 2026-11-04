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
      await pool.query("INSERT INTO agencies (id, trade_name, created_by) VALUES ($1, 'Agence A', $3), ($2, 'Agence B', $3)", [agencyId, otherAgency, userId]);
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
      await agencyPool.query("INSERT INTO agencies (id, trade_name, created_by) VALUES ($1, 'Agence HTTP', $3), ($2, 'Agence etrangere', $3)", [httpAgency, foreignAgency, account.id]);
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
      const foreignInvite = await createInvite(foreignAgency, tokens.accessToken, { email: 'invited@example.com', role: 'agent' });
      assert.equal(foreignInvite.status, 404, 'cannot invite into another agency');
      const unknownInvite = await createInvite('00000000-0000-4000-8000-0000000000ff', tokens.accessToken, { email: 'invited@example.com', role: 'agent' });
      const withoutEcho = ({ instance: _instance, traceId: _traceId, ...rest }) => rest;
      assert.deepEqual(withoutEcho(await foreignInvite.json()), withoutEcho(await unknownInvite.json()), 'refusal is identical to an unknown agency');
      const foreignRows = await agencyPool.query('SELECT count(*)::int AS total FROM agency_invitations WHERE agency_id = $1', [foreignAgency]);
      assert.equal(foreignRows.rows[0].total, 0, 'no invitation created for the other agency');
      await agencyPool.query("INSERT INTO agency_memberships (id, agency_id, user_id, role) VALUES ($1, $2, $3, 'owner')", ['00000000-0000-4000-8000-000000000025', foreignAgency, account.id]);
      const raceInvite = await createInvite(foreignAgency, tokens.accessToken, { email: 'invited@example.com', role: 'agent' });
      assert.equal(raceInvite.status, 201);
      const raceToken = (await raceInvite.json()).token;
      const race = await Promise.all([acceptToken(invitedTokens.accessToken, raceToken), acceptToken(invitedTokens.accessToken, raceToken)]);
      assert.deepEqual(race.map(response => response.status).sort(), [200, 404], 'one concurrent acceptance succeeds');
      const raceMembers = await agencyPool.query('SELECT count(*)::int AS total FROM agency_memberships WHERE agency_id = $1 AND user_id = $2', [foreignAgency, invitedUser]);
      assert.equal(raceMembers.rows[0].total, 1, 'a single membership is created');
      const postAgency = (access, body, key) => fetch(`${api}/agencies`, { method: 'POST', headers: { ...(access ? { authorization: `Bearer ${access}` } : {}), 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, body: JSON.stringify(body) });
      const getOnboarding = (access, id) => fetch(`${api}/agencies/${id}/onboarding`, { headers: access ? { authorization: `Bearer ${access}` } : {} });
      const countAgencies = async () => (await agencyPool.query('SELECT count(*)::int AS total FROM agencies')).rows[0].total;
      const outsider = '00000000-0000-4000-8000-000000000030';
      const former = '00000000-0000-4000-8000-000000000031';
      const outsiderAccess = accessFor(outsider, '00000000-0000-4000-8000-000000000032');
      const formerAccess = accessFor(former, '00000000-0000-4000-8000-000000000033');
      const revokedAccess = accessFor(outsider, '00000000-0000-4000-8000-000000000034');
      await agencyPool.query('INSERT INTO users (id) VALUES ($1), ($2)', [outsider, former]);
      await agencyPool.query("INSERT INTO sessions (id, user_id, token_digest, expires_at, revoked_at) VALUES ($1, $2, $3, now() + interval '1 hour', NULL), ($4, $5, $6, now() + interval '1 hour', NULL), ($7, $2, $8, now() + interval '1 hour', now())", ['00000000-0000-4000-8000-000000000032', outsider, 'c'.repeat(64), '00000000-0000-4000-8000-000000000033', former, 'd'.repeat(64), '00000000-0000-4000-8000-000000000034', 'e'.repeat(64)]);

      const draft = await postAgency(tokens.accessToken, { tradeName: '  Express Douala ' });
      assert.equal(draft.status, 201, 'a connected person creates an agency');
      assert.match(draft.headers.get('cache-control'), /no-store/);
      const created = await draft.json();
      assert.deepEqual(created, { agencyId: created.agencyId, tradeName: 'Express Douala', status: 'draft', role: 'owner' });
      const draftRow = await agencyPool.query('SELECT status, trade_name, version, created_by FROM agencies WHERE id = $1', [created.agencyId]);
      assert.deepEqual(draftRow.rows[0], { status: 'draft', trade_name: 'Express Douala', version: 1, created_by: account.id });
      const ownerRow = await agencyPool.query('SELECT role, active FROM agency_memberships WHERE agency_id = $1 AND user_id = $2', [created.agencyId, account.id]);
      assert.deepEqual(ownerRow.rows, [{ role: 'owner', active: true }], 'the creator is the active owner');
      const mine = await (await fetch(`${api}/me/agencies?limit=100`, { headers: { authorization: `Bearer ${tokens.accessToken}` } })).json();
      assert.ok(mine.items.some(item => item.agencyId === created.agencyId && item.role === 'owner'), 'the new agency is listed with the owner role');
      const merchantAgency = await (await postAgency(invitedTokens.accessToken, { tradeName: 'Tchoua Logistique' })).json();
      assert.equal(merchantAgency.status, 'draft', 'a merchant account can create an agency too');

      const before = await countAgencies();
      const refused = [{ tradeName: 'A' }, { tradeName: '   ' }, { tradeName: 'x'.repeat(121) }, {}, { tradeName: 5 }, { tradeName: 'Express Kribi', status: 'submitted' }, { tradeName: 'Express Kribi', agencyId: httpAgency }];
      for (const body of refused) assert.equal((await postAgency(tokens.accessToken, body)).status, 400, `refused ${JSON.stringify(body).slice(0, 60)}`);
      assert.equal((await postAgency(tokens.accessToken, { tradeName: 'Express Kribi' }, 'short')).status, 400, 'idempotency key too short');
      assert.equal((await postAgency(tokens.accessToken, { tradeName: 'Express Kribi' }, 'a key with spaces')).status, 400, 'idempotency key with spaces');
      assert.equal((await postAgency(null, { tradeName: 'Express Kribi' })).status, 401, 'anonymous creation refused');
      assert.equal((await postAgency(revokedAccess, { tradeName: 'Express Kribi' })).status, 401, 'revoked session cannot create');
      assert.equal(await countAgencies(), before, 'refused creations leave nothing behind');

      const keyed = await postAgency(tokens.accessToken, { tradeName: 'Express Kribi' }, 'cle-e2e-0001');
      assert.equal(keyed.status, 201);
      const keyedBody = await keyed.json();
      const total = await countAgencies();
      const replay = await postAgency(tokens.accessToken, { tradeName: ' Express Kribi' }, 'cle-e2e-0001');
      assert.equal(replay.status, 201, 'an idempotent replay answers like the original');
      assert.deepEqual(await replay.json(), keyedBody);
      assert.equal(await countAgencies(), total, 'the replay created nothing');
      assert.equal((await postAgency(tokens.accessToken, { tradeName: 'Express Limbe' }, 'cle-e2e-0001')).status, 409, 'same key, other content');
      assert.equal(await countAgencies(), total, 'the conflict created nothing');
      const otherPerson = await postAgency(invitedTokens.accessToken, { tradeName: 'Express Kribi' }, 'cle-e2e-0001');
      assert.equal(otherPerson.status, 201, 'a key belongs to its sender');
      assert.notEqual((await otherPerson.json()).agencyId, keyedBody.agencyId);

      const twins = await Promise.all([postAgency(tokens.accessToken, { tradeName: 'Concurrent Agency' }, 'cle-e2e-0002'), postAgency(tokens.accessToken, { tradeName: 'Concurrent Agency' }, 'cle-e2e-0002')]);
      assert.deepEqual(twins.map(response => response.status), [201, 201], 'simultaneous identical creations both succeed');
      const [twinA, twinB] = await Promise.all(twins.map(response => response.json()));
      assert.equal(twinA.agencyId, twinB.agencyId, 'both responses designate one agency');
      const twinRows = await agencyPool.query("SELECT (SELECT count(*)::int FROM agencies WHERE trade_name = 'Concurrent Agency') AS agencies, (SELECT count(*)::int FROM agency_memberships WHERE agency_id = $1) AS memberships", [twinA.agencyId]);
      assert.deepEqual(twinRows.rows[0], { agencies: 1, memberships: 1 }, 'one agency and one owner');
      const rivals = await Promise.all([postAgency(tokens.accessToken, { tradeName: 'Rival One' }, 'cle-e2e-0003'), postAgency(tokens.accessToken, { tradeName: 'Rival Two' }, 'cle-e2e-0003')]);
      assert.deepEqual(rivals.map(response => response.status).sort(), [201, 409], 'simultaneous creations with one key and two contents: one wins');
      const rivalRows = await agencyPool.query("SELECT count(*)::int AS total FROM agencies WHERE trade_name IN ('Rival One', 'Rival Two')");
      assert.equal(rivalRows.rows[0].total, 1);

      await agencyPool.query("INSERT INTO agency_memberships (id, agency_id, user_id, role, active) VALUES ('00000000-0000-4000-8000-000000000040', $1, $2, 'admin', true), ('00000000-0000-4000-8000-000000000041', $1, $3, 'agent', true), ('00000000-0000-4000-8000-000000000042', $1, $4, 'agent', false)", [created.agencyId, '00000000-0000-4000-8000-000000000012', invitedUser, former]);
      const fresh = { status: 'draft', submission: null, readyForSubmission: false, capabilities: [], hybrid: false, activeZones: 0, activeSites: 0, prerequisites: ['legal_name', 'headquarters_city', 'headquarters_address', 'primary_phone', 'active_capability', 'active_site'].map(code => ({ code, filled: false })) };
      for (const [role, access] of [['owner', tokens.accessToken], ['admin', adminAccess], ['agent', invitedTokens.accessToken]]) {
        const state = await getOnboarding(access, created.agencyId);
        assert.equal(state.status, 200, `${role} reads the onboarding state`);
        assert.match(state.headers.get('cache-control'), /no-store/);
        assert.deepEqual(await state.json(), fresh, `${role} sees a fresh draft`);
      }
      const unknownState = await getOnboarding(tokens.accessToken, '00000000-0000-4000-8000-0000000000fe');
      assert.equal(unknownState.status, 404);
      const hidden = withoutEcho(await unknownState.json());
      for (const [who, access, id] of [['an outsider', outsiderAccess, created.agencyId], ['a former member', formerAccess, created.agencyId], ['a member of another agency', tokens.accessToken, merchantAgency.agencyId]]) {
        const response = await getOnboarding(access, id);
        assert.equal(response.status, 404, `${who} finds nothing`);
        assert.deepEqual(withoutEcho(await response.json()), hidden, `${who} gets the answer of an unknown agency`);
      }
      assert.equal((await getOnboarding(null, created.agencyId)).status, 401, 'anonymous read refused');
      assert.equal((await getOnboarding(revokedAccess, created.agencyId)).status, 401, 'revoked session cannot read');
      assert.equal((await getOnboarding(tokens.accessToken, 'not-a-uuid')).status, 400, 'invalid agency id');

      await agencyPool.query("UPDATE agencies SET legal_name = 'Tchoua Express SARL', headquarters_city = 'Douala', primary_phone = '+237677123456' WHERE id = $1", [created.agencyId]);
      const partial = await (await getOnboarding(invitedTokens.accessToken, created.agencyId)).text();
      assert.deepEqual(JSON.parse(partial).prerequisites.filter(item => item.filled).map(item => item.code), ['legal_name', 'headquarters_city', 'primary_phone']);
      assert.ok(!partial.includes('Tchoua Express SARL') && !partial.includes('+237677123456') && !partial.includes('Douala'), 'identity values never leave');
      assert.equal(JSON.parse(partial).readyForSubmission, false);
      await agencyPool.query("UPDATE agencies SET status = 'submitted', submitted_at = '2026-11-15T10:00:00Z', submitted_by = $2 WHERE id = $1", [created.agencyId, account.id]);
      const submitted = await (await getOnboarding(tokens.accessToken, created.agencyId)).json();
      assert.deepEqual([submitted.status, submitted.submission, submitted.readyForSubmission], ['submitted', { submittedAt: '2026-11-15T10:00:00.000Z', submittedBy: account.id }, false]);

      // B2.2 and B2.6: read, identity, profile, optimistic version, rights, audit.
      const authHeaders = (access) => (access ? { authorization: `Bearer ${access}` } : {});
      const getAgency = (access, id) => fetch(`${api}/agencies/${id}`, { headers: authHeaders(access) });
      const patchAgency = (route, access, body, ifMatch) => fetch(`${api}/agencies/${route}`, { method: 'PATCH', headers: { ...authHeaders(access), 'content-type': 'application/json', ...(ifMatch === undefined ? {} : { 'if-match': ifMatch }) }, body: JSON.stringify(body) });
      const editable = (await (await postAgency(tokens.accessToken, { tradeName: 'Edition Express' })).json()).agencyId;
      const adminUser = '00000000-0000-4000-8000-000000000012';
      await agencyPool.query("INSERT INTO agency_memberships (id, agency_id, user_id, role, active) VALUES ($1, $2, $3, 'admin', true), ($4, $2, $5, 'agent', true), ($6, $2, $7, 'admin', false)", ['00000000-0000-4000-8000-000000000050', editable, adminUser, '00000000-0000-4000-8000-000000000051', invitedUser, '00000000-0000-4000-8000-000000000052', former]);
      const outsiderOwn = (await (await postAgency(outsiderAccess, { tradeName: 'Agence Voisine' })).json()).agencyId;
      const unknownAgency = '00000000-0000-4000-8000-0000000000fd';
      const row = async () => (await agencyPool.query('SELECT * FROM agencies WHERE id = $1', [editable])).rows[0];
      const edited = async () => (await agencyPool.query("SELECT action, user_id, details FROM identity_audit WHERE agency_id = $1 AND action IN ('agency.identity_updated', 'agency.profile_updated') ORDER BY occurred_at, id", [editable])).rows;

      for (const [role, access] of [['owner', tokens.accessToken], ['admin', adminAccess]]) {
        const read = await getAgency(access, editable);
        assert.equal(read.status, 200, `${role} reads the agency`);
        assert.equal(read.headers.get('etag'), '"1"', `${role} gets the version as an ETag`);
        assert.match(read.headers.get('cache-control'), /no-store/);
        assert.deepEqual(await read.json(), { id: editable, status: 'draft', tradeName: 'Edition Express', description: null, version: 1, identity: { legalName: null, headquartersCity: null, headquartersAddress: null, primaryPhone: null, contactEmail: null, rccm: null, niu: null } });
      }
      const agentRead = await getAgency(invitedTokens.accessToken, editable);
      assert.equal(agentRead.status, 403, 'an active agent does not read the identity');
      assert.ok(agentRead.headers.get('content-type').startsWith('application/problem+json'));
      const agentBody = await agentRead.text();
      for (const secret of ['legalName', 'primaryPhone', 'contactEmail', 'rccm', 'niu', 'Express Douala SARL', '+237677123456', 'Edition Express']) assert.ok(!agentBody.includes(secret), `the refusal does not carry ${secret}`);
      assert.equal(JSON.parse(agentBody).status, 403);
      for (const part of ['onboarding', 'zones', 'sites', 'members']) assert.equal((await fetch(`${api}/agencies/${editable}/${part}`, { headers: authHeaders(invitedTokens.accessToken) })).status, 200, `an agent still reads ${part}`);
      const unknownRead = await getAgency(tokens.accessToken, unknownAgency);
      assert.equal(unknownRead.status, 404);
      const unknownBody = withoutEcho(await unknownRead.json());
      for (const [who, access] of [['an outsider', outsiderAccess], ['a former member', formerAccess]]) {
        const response = await getAgency(access, editable);
        assert.equal(response.status, 404, `${who} cannot read`);
        assert.deepEqual(withoutEcho(await response.json()), unknownBody, `${who} gets the answer of an unknown agency`);
      }
      assert.equal((await getAgency(outsiderAccess, editable)).status, 404, 'a member of another agency cannot read');
      assert.equal((await getAgency(null, editable)).status, 401, 'anonymous read refused');
      assert.equal((await getAgency(tokens.accessToken, 'not-a-uuid')).status, 400, 'invalid agency id');

      const noPrecondition = await patchAgency(`${editable}/identity`, tokens.accessToken, { legalName: 'Express Douala SARL' });
      assert.equal(noPrecondition.status, 428, 'If-Match is required');
      assert.match(noPrecondition.headers.get('content-type'), /^application\/problem\+json/);
      assert.equal((await patchAgency(`${editable}/profile`, tokens.accessToken, { description: 'Livraison' })).status, 428, 'If-Match is required for the profile too');
      for (const malformed of ['abc', '"abc"', '0', '-1', '1.5', 'W/"1"', '"1", "2"', '*', '99999999999', '']) {
        assert.equal((await patchAgency(`${editable}/identity`, tokens.accessToken, { legalName: 'Express Douala SARL' }, malformed)).status, 400, `If-Match ${JSON.stringify(malformed)} refused`);
      }
      assert.equal((await row()).version, 1, 'refused requests wrote nothing');

      const firstEdit = await patchAgency(`${editable}/identity`, tokens.accessToken, { legalName: ' Express  Douala SARL ', headquartersCity: 'Douala' }, '"1"');
      assert.equal(firstEdit.status, 200, 'the owner completes the identity');
      assert.equal(firstEdit.headers.get('etag'), '"2"');
      assert.match(firstEdit.headers.get('cache-control'), /no-store/);
      assert.deepEqual(await firstEdit.json(), { version: 2, identity: { legalName: 'Express Douala SARL', headquartersCity: 'Douala', headquartersAddress: null, primaryPhone: null, contactEmail: null, rccm: null, niu: null } });
      const secondEdit = await patchAgency(`${editable}/identity`, adminAccess, { primaryPhone: '6 77 12 34 56', headquartersAddress: 'Rue Joss, face pharmacie du Rond-point' }, '2');
      assert.equal(secondEdit.status, 200, 'an administrator completes the identity, a bare version is accepted');
      const secondBody = await secondEdit.json();
      assert.deepEqual([secondBody.version, secondBody.identity.primaryPhone, secondBody.identity.legalName], [3, '+237677123456', 'Express Douala SARL'], 'partial update keeps the other fields');
      assert.equal((await getAgency(adminAccess, editable)).headers.get('etag'), '"3"');
      const afterIdentity = await (await getOnboarding(tokens.accessToken, editable)).json();
      assert.deepEqual(afterIdentity.prerequisites.filter(item => item.filled).map(item => item.code), ['legal_name', 'headquarters_city', 'headquarters_address', 'primary_phone'], 'the four identity prerequisites are met');

      const agentTries = [['identity', { legalName: 'Fotso SARL' }], ['profile', { description: 'Meilleure agence' }]];
      for (const [route, body] of agentTries) assert.equal((await patchAgency(`${editable}/${route}`, invitedTokens.accessToken, body, '3')).status, 403, `an agent cannot edit the ${route}`);
      const hiddenFrom = [['an outsider', outsiderAccess, editable], ['a former member', formerAccess, editable], ['a member of another agency', outsiderAccess, editable], ['anyone, on an unknown agency', tokens.accessToken, unknownAgency]];
      let hiddenBody = null;
      for (const [who, access, id] of hiddenFrom) {
        for (const [route, body] of [['identity', { legalName: 'Autre SARL' }], ['profile', { description: 'Autre présentation' }]]) {
          const response = await patchAgency(`${id}/${route}`, access, body, '3');
          assert.equal(response.status, 404, `${who} finds no agency to edit (${route})`);
          const problem = withoutEcho(await response.json());
          hiddenBody = hiddenBody ?? problem;
          assert.deepEqual(problem, hiddenBody, `${who}: same answer as an unknown agency (${route})`);
        }
      }
      assert.equal((await patchAgency(`${outsiderOwn}/identity`, tokens.accessToken, { legalName: 'Autre SARL' }, '1')).status, 404, 'the owner of one agency cannot edit another');
      assert.equal((await patchAgency(`${editable}/identity`, null, { legalName: 'Autre SARL' }, '3')).status, 401, 'anonymous edit refused');
      assert.equal((await patchAgency(`${editable}/profile`, revokedAccess, { description: 'Autre' }, '3')).status, 401, 'revoked session cannot edit');
      assert.equal((await patchAgency('not-a-uuid/identity', tokens.accessToken, { legalName: 'Autre SARL' }, '3')).status, 400, 'invalid agency id');
      assert.deepEqual([(await row()).version, (await row()).legal_name], [3, 'Express Douala SARL'], 'refused edits wrote nothing');

      const refusedIdentity = [
        { status: 'approved' }, { legalName: 'Express Douala SARL', agencyId: outsiderOwn }, { version: 9 }, { tradeName: 'Autre Nom' }, { description: 'x' },
        { primaryPhone: '677 12 34' }, { primaryPhone: '5 77 12 34 56' }, { primaryPhone: '+33 6 12 34 56 78' }, { primaryPhone: 677123456 },
        { legalName: 'x' }, { legalName: 'x'.repeat(201) }, { legalName: null }, { legalName: 5 }, { legalName: 'Nom\u0000Nul' },
        { headquartersCity: 'D' }, { headquartersAddress: 'Rue' }, { contactEmail: 'contact@' }, { contactEmail: 'a\u0000b@c.cm' }, { contactEmail: 'a\u0007@b.cm' }, { contactEmail: 'a\u202E@b.cm' }, { rccm: 'RC' }, { niu: 'M0123456789A' }, { niu: 5 },
      ];
      for (const body of refusedIdentity) assert.equal((await patchAgency(`${editable}/identity`, tokens.accessToken, body, '3')).status, 400, `identity refused ${JSON.stringify(body).slice(0, 60)}`);
      assert.equal((await patchAgency(`${editable}/identity`, tokens.accessToken, ['legalName'], '3')).status, 400, 'a list is not an identity');
      const refusedProfile = [{ legalName: 'Autre SARL' }, { status: 'approved' }, { tradeName: '' }, { tradeName: 'A' }, { tradeName: 'x'.repeat(121) }, { tradeName: null }, { description: 'x'.repeat(1001) }, { description: 'a\u0000b' }, { description: 5 }, { primaryPhone: '677123456' }];
      for (const body of refusedProfile) assert.equal((await patchAgency(`${editable}/profile`, tokens.accessToken, body, '3')).status, 400, `profile refused ${JSON.stringify(body).slice(0, 60)}`);
      assert.deepEqual([(await row()).version, (await row()).legal_name, (await row()).contact_email], [3, 'Express Douala SARL', null], 'invalid bodies wrote nothing');
      const controlEmail = await patchAgency(`${editable}/identity`, tokens.accessToken, { contactEmail: 'a\u0000b@c.cm' }, '3');
      assert.equal(controlEmail.status, 400, 'a control character in the contact e-mail is a 400, not a 500');
      assert.ok(controlEmail.headers.get('content-type').startsWith('application/problem+json'));

      const stale = await patchAgency(`${editable}/identity`, tokens.accessToken, { headquartersCity: 'Edéa' }, '2');
      assert.equal(stale.status, 409, 'a stale version is a conflict');
      assert.equal((await patchAgency(`${editable}/identity`, tokens.accessToken, { headquartersCity: 'Edéa' }, '4')).status, 409, 'a future version is a conflict too');
      assert.equal((await patchAgency(`${editable}/profile`, adminAccess, { description: 'Ancienne présentation' }, '2')).status, 409, 'stale profile');
      assert.deepEqual([(await row()).version, (await row()).headquarters_city, (await row()).description], [3, 'Douala', null], 'a conflict writes nothing');

      const sameValues = await patchAgency(`${editable}/identity`, tokens.accessToken, { legalName: 'Express  Douala SARL', primaryPhone: '+237 677 12 34 56' }, '3');
      assert.equal(sameValues.status, 200);
      assert.equal((await sameValues.json()).version, 3, 'no real change: same version');
      assert.equal((await patchAgency(`${editable}/identity`, tokens.accessToken, {}, '3')).status, 200, 'an empty change is accepted and does nothing');
      assert.equal((await row()).version, 3);

      const optional = await patchAgency(`${editable}/identity`, tokens.accessToken, { contactEmail: 'Contact@Express.cm', rccm: 'RC/DLA/2020/B/1234', niu: 'M012345678901A' }, '3');
      assert.deepEqual([optional.status, (await optional.json()).identity.contactEmail], [200, 'contact@express.cm']);
      const cleared = await patchAgency(`${editable}/identity`, tokens.accessToken, { contactEmail: null, rccm: '  ', niu: null }, '4');
      assert.deepEqual((await cleared.json()).identity, { legalName: 'Express Douala SARL', headquartersCity: 'Douala', headquartersAddress: 'Rue Joss, face pharmacie du Rond-point', primaryPhone: '+237677123456', contactEmail: null, rccm: null, niu: null });
      assert.deepEqual([(await row()).version, (await row()).contact_email, (await row()).rccm, (await row()).niu], [5, null, null, null]);

      const profile = await patchAgency(`${editable}/profile`, adminAccess, { description: ' Livraison express dans Douala, 7j/7 ' }, '5');
      assert.equal(profile.status, 200, 'an administrator edits the profile');
      assert.equal(profile.headers.get('etag'), '"6"');
      assert.deepEqual(await profile.json(), { version: 6, tradeName: 'Edition Express', description: 'Livraison express dans Douala, 7j/7' });
      const renamed = await patchAgency(`${editable}/profile`, tokens.accessToken, { tradeName: 'Edition Express & Littoral' }, '6');
      assert.deepEqual(await renamed.json(), { version: 7, tradeName: 'Edition Express & Littoral', description: 'Livraison express dans Douala, 7j/7' });
      const markup = await patchAgency(`${editable}/profile`, tokens.accessToken, { description: '<b>gras</b> & <script>alert(1)</script>' }, '7');
      assert.equal((await markup.json()).description, '<b>gras</b> & <script>alert(1)</script>', 'markup is stored as plain text');
      assert.equal((await patchAgency(`${editable}/profile`, tokens.accessToken, { description: 'x'.repeat(1000) }, '8')).status, 200, 'a description of 1000 characters');
      const emptied = await patchAgency(`${editable}/profile`, tokens.accessToken, { description: null }, '9');
      assert.deepEqual(await emptied.json(), { version: 10, tradeName: 'Edition Express & Littoral', description: null });
      assert.equal((await row()).description, null);

      const [firstRace, secondRace] = await Promise.all([patchAgency(`${editable}/identity`, tokens.accessToken, { headquartersCity: 'Edéa' }, '10'), patchAgency(`${editable}/identity`, adminAccess, { headquartersCity: 'Kribi' }, '10')]);
      assert.deepEqual([firstRace.status, secondRace.status].sort(), [200, 409], 'two identity edits on one version: one wins');
      assert.equal((await row()).version, 11);
      assert.equal((await row()).headquarters_city, firstRace.status === 200 ? 'Edéa' : 'Kribi', 'the winner is the one stored');
      const mixed = await Promise.all([patchAgency(`${editable}/identity`, tokens.accessToken, { niu: 'M012345678901A' }, '11'), patchAgency(`${editable}/profile`, adminAccess, { description: 'Course' }, '11')]);
      assert.deepEqual(mixed.map(response => response.status).sort(), [200, 409], 'an identity edit and a profile edit on one version: one wins');
      const crowd = await Promise.all(Array.from({ length: 6 }, (_, index) => patchAgency(`${editable}/profile`, index % 2 ? tokens.accessToken : adminAccess, { description: `Foule ${index}` }, '12')));
      assert.deepEqual(crowd.map(response => response.status).sort(), [200, 409, 409, 409, 409, 409], 'six profile edits on one version: exactly one wins');
      assert.equal((await row()).version, 13, 'the version moved once per winner');

      assert.equal((await patchAgency(`${created.agencyId}/identity`, tokens.accessToken, { legalName: 'Express Cameroun SARL' }, String((await (await getAgency(tokens.accessToken, created.agencyId)).json()).version))).status, 409, 'the identity of a submitted agency is locked');
      const lockedRow = (await agencyPool.query('SELECT legal_name, status, version FROM agencies WHERE id = $1', [created.agencyId])).rows[0];
      assert.deepEqual([lockedRow.legal_name, lockedRow.status], ['Tchoua Express SARL', 'submitted'], 'a locked identity is untouched');
      const submittedProfile = await patchAgency(`${created.agencyId}/profile`, tokens.accessToken, { description: 'Livraison et stockage à Douala' }, String(lockedRow.version));
      assert.equal(submittedProfile.status, 200, 'the profile of a submitted agency stays editable');
      assert.deepEqual([(await getAgency(tokens.accessToken, created.agencyId).then(response => response.json())).status], ['submitted'], 'the status did not move');
      await assert.rejects(agencyPool.query("UPDATE agencies SET primary_phone = '0677123456' WHERE id = $1", [editable]), /agencies_primary_phone_format/, 'the database refuses a malformed phone');
      await assert.rejects(agencyPool.query("UPDATE agencies SET niu = 'short' WHERE id = $1", [editable]), /agencies_niu_format/, 'the database refuses a malformed NIU');

      const trail = await edited();
      assert.deepEqual(trail.slice(0, 6).map(entry => [entry.action, entry.user_id, entry.details]), [
        ['agency.identity_updated', account.id, { fields: ['legalName', 'headquartersCity'] }],
        ['agency.identity_updated', adminUser, { fields: ['headquartersAddress', 'primaryPhone'] }],
        ['agency.identity_updated', account.id, { fields: ['contactEmail', 'rccm', 'niu'] }],
        ['agency.identity_updated', account.id, { fields: ['contactEmail', 'rccm', 'niu'] }],
        ['agency.profile_updated', adminUser, { fields: ['description'] }],
        ['agency.profile_updated', account.id, { fields: ['tradeName'] }],
      ], 'effective edits are audited with field names');
      const serialized = JSON.stringify(trail);
      for (const secret of ['+237677123456', 'Douala', 'Rue Joss', 'Livraison', 'express.cm', 'RC/DLA', 'M012345678901A', 'Edition']) assert.ok(!serialized.includes(secret), `the audit never holds "${secret}"`);
      const editAudit = (await agencyPool.query("SELECT count(*) FILTER (WHERE action = 'agency.identity_updated')::int AS identity, count(*) FILTER (WHERE action = 'agency.profile_updated')::int AS profile FROM identity_audit WHERE agency_id = ANY($1)", [[editable, created.agencyId]])).rows[0];
      assert.equal(editAudit.identity + editAudit.profile, 13, 'one audit row per effective edit, none for refusals and no-ops');

      {
      // B2.3, B2.8, B2.4 and B2.7: served zones, sites and capabilities.
      const { randomUUID } = require('node:crypto');
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      const configured = [];
      const configAgency = async () => {
        const id = randomUUID();
        await agencyPool.query("INSERT INTO agencies (id, trade_name, created_by) VALUES ($1, 'Configuration Express', $2)", [id, account.id]);
        for (const [user, role, active] of [[account.id, 'owner', true], [adminUser, 'admin', true], [invitedUser, 'agent', true], [former, 'admin', false]]) {
          await agencyPool.query('INSERT INTO agency_memberships (id, agency_id, user_id, role, active) VALUES ($1, $2, $3, $4, $5)', [randomUUID(), id, user, role, active]);
        }
        configured.push(id);
        return id;
      };
      const act = (method, path, access, body, headers = {}) => fetch(`${api}/agencies/${path}`, { method, headers: { ...authHeaders(access), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const ownerAccess = tokens.accessToken;
      const agentAccess = invitedTokens.accessToken;
      const writers = [['owner', ownerAccess], ['admin', adminAccess]];
      const problemOf = async (response, status, code, message) => {
        assert.equal(response.status, status, message);
        assert.match(response.headers.get('content-type'), /^application\/problem\+json/, message);
        const problem = await response.json();
        if (code !== undefined) assert.equal(problem.code, code, message);
        return problem;
      };
      /** Every way of not being allowed to see the agency gives the answer of an unknown agency. */
      const assertHidden = async (target, method, pathOf, body, headers) => {
        const unknown = await act(method, pathOf(unknownAgency), ownerAccess, body, headers);
        assert.equal(unknown.status, 404, `${target}: unknown agency`);
        const expected = withoutEcho(await unknown.json());
        for (const [who, access, agency] of [['an outsider', outsiderAccess, activeOne], ['a former member', formerAccess, activeOne], ['the owner of another agency', ownerAccess, outsiderOwn]]) {
          const response = await act(method, pathOf(agency), access, body, headers);
          assert.equal(response.status, 404, `${target}: ${who} finds nothing`);
          assert.deepEqual(withoutEcho(await response.json()), expected, `${target}: ${who} gets the answer of an unknown agency`);
        }
        assert.equal((await act(method, pathOf(activeOne), null, body, headers)).status, 401, `${target}: anonymous`);
        assert.equal((await act(method, pathOf(activeOne), revokedAccess, body, headers)).status, 401, `${target}: revoked session`);
        assert.equal((await act(method, pathOf('not-a-uuid'), ownerAccess, body, headers)).status, 400, `${target}: invalid agency id`);
      };
      let activeOne = null;
      const zoneRows = async (agency) => (await agencyPool.query('SELECT id, city, district, retired_at FROM service_zones WHERE agency_id = $1 ORDER BY city_key, district_key', [agency])).rows;
      const configAudit = async (agency) => (await agencyPool.query("SELECT action, user_id, details, resource_id FROM identity_audit WHERE agency_id = $1 AND action ~ '^agency\\.(zone|site|capability)_' ORDER BY occurred_at, id", [agency])).rows;

      // Zones
      const zonesAgency = await configAgency();
      activeOne = zonesAgency;
      const addZone = (agency, access, body) => act('POST', `${agency}/zones`, access, body);
      const akwaZone = await addZone(zonesAgency, ownerAccess, { city: ' Douala ', district: 'Akwa' });
      assert.equal(akwaZone.status, 201, 'the owner adds a zone');
      assert.match(akwaZone.headers.get('cache-control'), /no-store/);
      const akwa = await akwaZone.json();
      assert.match(akwa.id, UUID);
      assert.deepEqual([akwa.city, akwa.district, akwa.status, akwa.retiredAt], ['Douala', 'Akwa', 'active', null]);
      assert.ok(Number.isFinite(Date.parse(akwa.addedAt)));
      const wholeCity = await addZone(zonesAgency, adminAccess, { city: 'Yaoundé' });
      assert.equal(wholeCity.status, 201, 'an administrator adds a whole city');
      assert.equal((await wholeCity.json()).district, null);
      assert.equal((await addZone(zonesAgency, ownerAccess, { city: 'Kribi', district: null })).status, 201, 'a null district means the whole city');
      for (const [city, district] of [['Douala', 'Akwa'], ['douala', 'AKWA'], ['Douala', 'Akwá'], [' DOUALA  ', ' akwa ']]) {
        await problemOf(await addZone(zonesAgency, adminAccess, { city, district }), 409, 'ZONE_ALREADY_SERVED', `duplicate ${city}/${district}`);
      }
      assert.equal((await addZone(zonesAgency, ownerAccess, { city: 'Douala' })).status, 201, 'a city and one of its districts are different zones');
      const refusedZones = [{}, { district: 'Akwa' }, { city: 'x' }, { city: 'x'.repeat(81) }, { city: 'Douala', district: 'x' }, { city: 'Douala', district: 'x'.repeat(81) }, { city: 5 }, { city: 'Dou\u0000ala' }, { city: 'Kumba', agencyId: outsiderOwn }, { city: 'Kumba', status: 'retired' }, { city: 'Kumba', id: randomUUID() }];
      for (const body of refusedZones) assert.equal((await addZone(zonesAgency, ownerAccess, body)).status, 400, `zone refused ${JSON.stringify(body).slice(0, 60)}`);
      assert.equal((await act('POST', `${zonesAgency}/zones`, ownerAccess, ['Douala'])).status, 400, 'a list is not a zone');
      assert.equal((await addZone(zonesAgency, ownerAccess, { city: 'x'.repeat(80) })).status, 201, 'a city of 80 characters');
      assert.equal((await addZone(zonesAgency, ownerAccess, { city: 'xx' })).status, 201, 'a city of 2 characters');
      assert.equal((await zoneRows(zonesAgency)).length, 6, 'only the accepted zones exist');
      await assertHidden('add zone', 'POST', agency => `${agency}/zones`, { city: 'Kumba' });
      assert.equal((await addZone(zonesAgency, agentAccess, { city: 'Kumba' })).status, 403, 'an agent cannot add a zone');
      assert.equal((await zoneRows(zonesAgency)).length, 6, 'refused additions wrote nothing');

      for (const [role, access] of [...writers, ['agent', agentAccess]]) {
        const list = await act('GET', `${zonesAgency}/zones`, access);
        assert.equal(list.status, 200, `${role} reads the zones`);
        assert.match(list.headers.get('cache-control'), /no-store/);
        const page = await list.json();
        assert.deepEqual([page.items.length, page.hasMore, page.nextCursor], [6, false, null], `${role}: one page`);
        assert.deepEqual(page.items.map(zone => zone.status), Array(6).fill('active'));
      }
      await assertHidden('list zones', 'GET', agency => `${agency}/zones`);

      // Retirement: logical, audited, never physical.
      const retireZone = (agency, zone, access) => act('DELETE', `${agency}/zones/${zone}`, access);
      assert.equal((await retireZone(zonesAgency, akwa.id, agentAccess)).status, 403, 'an agent cannot retire a zone');
      const retired = await retireZone(zonesAgency, akwa.id, adminAccess);
      assert.equal(retired.status, 200, 'an administrator retires a zone');
      const retiredBody = await retired.json();
      assert.deepEqual([retiredBody.id, retiredBody.status, retiredBody.retiredAt === null], [akwa.id, 'retired', false]);
      assert.equal((await zoneRows(zonesAgency)).length, 6, 'a retired zone is kept');
      await problemOf(await retireZone(zonesAgency, akwa.id, ownerAccess), 409, 'ZONE_ALREADY_RETIRED', 'retiring twice');
      assert.equal((await retireZone(zonesAgency, randomUUID(), ownerAccess)).status, 404, 'an unknown zone');
      assert.equal((await retireZone(zonesAgency, 'not-a-uuid', ownerAccess)).status, 400, 'invalid zone id');
      const foreignZone = (await (await addZone(outsiderOwn, outsiderAccess, { city: 'Bafoussam' })).json()).id;
      const unknownZone = withoutEcho(await (await retireZone(zonesAgency, randomUUID(), ownerAccess)).json());
      const foreignRetire = await retireZone(zonesAgency, foreignZone, ownerAccess);
      assert.equal(foreignRetire.status, 404, 'a zone of another agency is not found');
      assert.deepEqual(withoutEcho(await foreignRetire.json()), unknownZone, 'same answer as an unknown zone');
      assert.equal((await retireZone(outsiderOwn, foreignZone, ownerAccess)).status, 404, 'nor through the other agency');
      assert.equal((await zoneRows(outsiderOwn))[0].retired_at, null, 'the other agency zone is untouched');
      await assertHidden('retire zone', 'DELETE', agency => `${agency}/zones/${foreignZone}`);
      const listedAfter = await (await act('GET', `${zonesAgency}/zones`, agentAccess)).json();
      assert.equal(listedAfter.items.at(-1).id, akwa.id, 'retired zones come after the active ones');
      assert.equal(listedAfter.items.at(-1).status, 'retired');
      const readded = await addZone(zonesAgency, ownerAccess, { city: 'douala', district: 'AKWÁ' });
      assert.equal(readded.status, 201, 'adding a retired zone again is accepted');
      assert.deepEqual([(await readded.json()).id, (await zoneRows(zonesAgency)).length], [akwa.id, 6], 'it is the same zone, not a second one');
      assert.equal((await zoneRows(zonesAgency)).find(zone => zone.id === akwa.id).retired_at, null);

      // Pagination, with zones inserted in bulk.
      const pagedZones = await configAgency();
      await agencyPool.query("INSERT INTO service_zones (id, agency_id, city, district, city_key, district_key, added_at) SELECT gen_random_uuid(), $1, 'Ville ' || lpad(n::text, 2, '0'), NULL, 'ville ' || lpad(n::text, 2, '0'), '', now() FROM generate_series(1, 25) n", [pagedZones]);
      await agencyPool.query("UPDATE service_zones SET retired_at = now() WHERE agency_id = $1 AND city IN ('Ville 03', 'Ville 04')", [pagedZones]);
      const seenZones = [];
      let zoneCursor = null;
      const sizes = [];
      for (let guard = 0; guard < 10; guard++) {
        const page = await (await act('GET', `${pagedZones}/zones?limit=10${zoneCursor ? `&cursor=${zoneCursor}` : ''}`, agentAccess)).json();
        sizes.push([page.items.length, page.hasMore]);
        seenZones.push(...page.items);
        if (!page.hasMore) { assert.equal(page.nextCursor, null); break; }
        assert.equal(page.nextCursor, page.items.at(-1).id);
        zoneCursor = page.nextCursor;
      }
      assert.deepEqual(sizes, [[10, true], [10, true], [5, false]], 'pages of 10, 10 and 5');
      assert.equal(new Set(seenZones.map(zone => zone.id)).size, 25, 'no zone twice, none missing');
      assert.deepEqual(seenZones.map(zone => zone.status), [...Array(23).fill('active'), 'retired', 'retired'], 'active zones first, then retired ones');
      assert.deepEqual(seenZones.slice(0, 3).map(zone => zone.city), ['Ville 01', 'Ville 02', 'Ville 05'], 'ordered by city');
      for (const limit of ['0', '101', 'abc', '1.5', '-1']) assert.equal((await act('GET', `${pagedZones}/zones?limit=${limit}`, ownerAccess)).status, 400, `limit ${limit}`);
      assert.equal((await act('GET', `${pagedZones}/zones?cursor=not-a-uuid`, ownerAccess)).status, 400, 'invalid cursor');
      assert.equal((await (await act('GET', `${pagedZones}/zones?limit=100`, ownerAccess)).json()).items.length, 25, 'a limit of 100');

      // At most 100 active zones.
      await agencyPool.query("INSERT INTO service_zones (id, agency_id, city, district, city_key, district_key, added_at) SELECT gen_random_uuid(), $1, 'Bourg ' || lpad(n::text, 3, '0'), NULL, 'bourg ' || lpad(n::text, 3, '0'), '', now() FROM generate_series(1, 77) n", [pagedZones]);
      const full = await agencyPool.query('SELECT count(*)::int AS active FROM service_zones WHERE agency_id = $1 AND retired_at IS NULL', [pagedZones]);
      assert.equal(full.rows[0].active, 100);
      await problemOf(await addZone(pagedZones, ownerAccess, { city: 'Kribi' }), 409, 'ZONE_LIMIT_REACHED', 'the 101st zone');
      await problemOf(await addZone(pagedZones, ownerAccess, { city: 'Ville 03' }), 409, 'ZONE_LIMIT_REACHED', 'reactivation is an addition too');
      assert.equal((await addZone(pagedZones, ownerAccess, { city: 'Ville 01' })).status, 409, 'a duplicate is still a conflict at the limit');
      const hundredth = (await agencyPool.query("SELECT id FROM service_zones WHERE agency_id = $1 AND city = 'Bourg 001'", [pagedZones])).rows[0].id;
      assert.equal((await retireZone(pagedZones, hundredth, ownerAccess)).status, 200);
      assert.equal((await addZone(pagedZones, ownerAccess, { city: 'Kribi' })).status, 201, 'a retired zone frees a place');

      // Database guards, behind the domain rules.
      await assert.rejects(agencyPool.query("INSERT INTO service_zones (id, agency_id, city, district, city_key, district_key, added_at) VALUES ($1, $2, 'Douala', 'Akwa', 'douala', 'akwa', now())", [randomUUID(), zonesAgency]), /service_zones_active_area_unique/, 'the database refuses two active equal zones');
      await assert.rejects(agencyPool.query("INSERT INTO service_zones (id, agency_id, city, district, city_key, district_key, added_at) VALUES ($1, $2, 'x', NULL, 'x', '', now())", [randomUUID(), zonesAgency]), /service_zones_city_length/, 'the database refuses a short city');
      await assert.rejects(agencyPool.query("INSERT INTO service_zones (id, agency_id, city, district, city_key, district_key, added_at) VALUES ($1, $2, 'Douala', NULL, 'douala', '', now())", [randomUUID(), randomUUID()]), /service_zones_agency_id_agencies_id_fk/, 'a zone belongs to an agency');
      await agencyPool.query("INSERT INTO service_zones (id, agency_id, city, district, city_key, district_key, added_at, retired_at) VALUES ($1, $2, 'Douala', 'Akwa', 'douala', 'akwa', now(), now())", [randomUUID(), zonesAgency]);

      // Sites
      const sitesAgency = await configAgency();
      activeOne = sitesAgency;
      const createSite = (agency, access, body) => act('POST', `${agency}/sites`, access, body);
      const patchSite = (agency, site, access, body, ifMatch) => act('PATCH', `${agency}/sites/${site}`, access, body, ifMatch === undefined ? {} : { 'if-match': ifMatch });
      const siteAction = (agency, site, action, access) => act('POST', `${agency}/sites/${site}/${action}`, access);
      const akwaSite = await createSite(sitesAgency, ownerAccess, { name: '  Agence  Akwa ', city: 'Douala', address: 'Rue Joss, face Total Akwa', phone: '6 77 12 34 56' });
      assert.equal(akwaSite.status, 201, 'the owner creates a site');
      assert.match(akwaSite.headers.get('cache-control'), /no-store/);
      assert.equal(akwaSite.headers.get('etag'), '"1"', 'the site version is an ETag');
      const site = await akwaSite.json();
      assert.match(site.id, UUID);
      assert.deepEqual({ ...site, id: undefined, createdAt: undefined }, { id: undefined, name: 'Agence Akwa', city: 'Douala', address: 'Rue Joss, face Total Akwa', phone: '+237677123456', status: 'active', createdAt: undefined, deactivatedAt: null, version: 1 });
      const depot = await (await createSite(sitesAgency, adminAccess, { name: 'Dépôt Bonabéri', city: 'Douala', address: 'Zone industrielle de Bonabéri' })).json();
      assert.deepEqual([depot.phone, depot.version], [null, 1], 'the phone is optional');
      for (const name of ['Agence Akwa', 'agence AKWA', 'Agence  Akwà']) {
        await problemOf(await createSite(sitesAgency, adminAccess, { name, city: 'Douala', address: 'Rue Joss, Akwa' }), 409, 'SITE_NAME_TAKEN', `duplicate ${name}`);
      }
      const refusedSites = [
        {}, { name: 'Agence Bali', city: 'Douala' }, { city: 'Douala', address: 'Rue Joss, Akwa' },
        { name: 'x', city: 'Douala', address: 'Rue Joss, Akwa' }, { name: 'x'.repeat(121), city: 'Douala', address: 'Rue Joss, Akwa' },
        { name: 'Agence Bali', city: 'x', address: 'Rue Joss, Akwa' }, { name: 'Agence Bali', city: 'x'.repeat(81), address: 'Rue Joss, Akwa' },
        { name: 'Agence Bali', city: 'Douala', address: 'Rue' }, { name: 'Agence Bali', city: 'Douala', address: 'x'.repeat(301) },
        { name: 'Agence Bali', city: 'Douala', address: 'Rue Joss, Akwa', phone: '677 12 34' }, { name: 'Agence Bali', city: 'Douala', address: 'Rue Joss, Akwa', phone: '+33 6 12 34 56 78' },
        { name: 'Agence Bali', city: 'Douala', address: 'Rue Joss, Akwa', phone: 677123456 }, { name: 5, city: 'Douala', address: 'Rue Joss, Akwa' },
        { name: 'Agence\u0000Bali', city: 'Douala', address: 'Rue Joss, Akwa' }, { name: 'Agence Bali', city: 'Douala', address: 'Rue Joss, Akwa', status: 'active' },
        { name: 'Agence Bali', city: 'Douala', address: 'Rue Joss, Akwa', agencyId: outsiderOwn }, { name: 'Agence Bali', city: 'Douala', address: 'Rue Joss, Akwa', version: 4 },
      ];
      for (const body of refusedSites) assert.equal((await createSite(sitesAgency, ownerAccess, body)).status, 400, `site refused ${JSON.stringify(body).slice(0, 70)}`);
      assert.equal((await createSite(sitesAgency, ownerAccess, { name: 'xx', city: 'xx', address: 'x'.repeat(5), phone: '  ' })).status, 201, 'minimal bounds, a blank phone');
      assert.equal((await createSite(sitesAgency, ownerAccess, { name: 'n'.repeat(120), city: 'c'.repeat(80), address: 'a'.repeat(300) })).status, 201, 'maximal bounds');
      assert.equal((await createSite(sitesAgency, agentAccess, { name: 'Agence Bali', city: 'Douala', address: 'Rue Joss, Akwa' })).status, 403, 'an agent cannot create a site');
      await assertHidden('create site', 'POST', agency => `${agency}/sites`, { name: 'Agence Bali', city: 'Douala', address: 'Rue Joss, Akwa' });
      assert.equal((await agencyPool.query('SELECT count(*)::int AS total FROM agency_sites WHERE agency_id = $1', [sitesAgency])).rows[0].total, 4, 'only the accepted sites exist');

      // Modification under the version of the site.
      assert.equal((await patchSite(sitesAgency, site.id, ownerAccess, { city: 'Yaoundé' })).status, 428, 'If-Match is required');
      for (const malformed of ['abc', '"abc"', '0', '-1', '1.5', 'W/"1"', '"1", "2"', '*', '99999999999', '']) {
        assert.equal((await patchSite(sitesAgency, site.id, ownerAccess, { city: 'Yaoundé' }, malformed)).status, 400, `If-Match ${JSON.stringify(malformed)} refused`);
      }
      const edited = await patchSite(sitesAgency, site.id, adminAccess, { address: ' Rue Joss,  immeuble Bleu ', phone: null }, '"1"');
      assert.equal(edited.status, 200, 'an administrator edits the site');
      assert.equal(edited.headers.get('etag'), '"2"');
      assert.match(edited.headers.get('cache-control'), /no-store/);
      const editedBody = await edited.json();
      assert.deepEqual([editedBody.version, editedBody.address, editedBody.phone, editedBody.name, editedBody.city], [2, 'Rue Joss, immeuble Bleu', null, 'Agence Akwa', 'Douala'], 'partial update keeps the other fields');
      await problemOf(await patchSite(sitesAgency, site.id, ownerAccess, { city: 'Yaoundé' }, '1'), 409, 'STALE_SITE_VERSION', 'stale site version');
      await problemOf(await patchSite(sitesAgency, site.id, ownerAccess, { city: 'Yaoundé' }, '3'), 409, 'STALE_SITE_VERSION', 'future site version');
      const unchanged = await patchSite(sitesAgency, site.id, ownerAccess, { name: 'Agence Akwa', city: 'Douala' }, '2');
      assert.deepEqual([unchanged.status, (await unchanged.json()).version], [200, 2], 'no real change: same version');
      await problemOf(await patchSite(sitesAgency, site.id, ownerAccess, { name: 'DÉPÔT bonabéri' }, '2'), 409, 'SITE_NAME_TAKEN', 'rename to a taken name');
      assert.equal((await patchSite(sitesAgency, site.id, ownerAccess, { name: 'AGENCE AKWA' }, '2')).status, 200, 'a change of case on its own name');
      for (const body of [{ name: null }, { city: null }, { address: null }, { name: 'x' }, { phone: '12' }, { status: 'inactive' }, { version: 9 }, { agencyId: outsiderOwn }, { id: randomUUID() }]) {
        assert.equal((await patchSite(sitesAgency, site.id, ownerAccess, body, '3')).status, 400, `site change refused ${JSON.stringify(body)}`);
      }
      assert.equal((await patchSite(sitesAgency, site.id, agentAccess, { city: 'Kribi' }, '3')).status, 403, 'an agent cannot edit a site');
      assert.equal((await patchSite(sitesAgency, randomUUID(), ownerAccess, { city: 'Kribi' }, '1')).status, 404, 'an unknown site');
      assert.equal((await patchSite(sitesAgency, 'not-a-uuid', ownerAccess, { city: 'Kribi' }, '1')).status, 400, 'invalid site id');
      const foreignSite = (await (await createSite(outsiderOwn, outsiderAccess, { name: 'Dépôt Bafoussam', city: 'Bafoussam', address: 'Rue du Marché, Bafoussam' })).json()).id;
      assert.equal((await patchSite(sitesAgency, foreignSite, ownerAccess, { city: 'Kribi' }, '1')).status, 404, 'a site of another agency is not found');
      assert.equal((await siteAction(sitesAgency, foreignSite, 'deactivate', ownerAccess)).status, 404, 'nor deactivated');
      assert.equal((await siteAction(outsiderOwn, foreignSite, 'deactivate', ownerAccess)).status, 404, 'nor through the other agency');
      assert.equal((await agencyPool.query('SELECT deactivated_at, version FROM agency_sites WHERE id = $1', [foreignSite])).rows[0].version, 1, 'the other agency site is untouched');
      await assertHidden('edit site', 'PATCH', agency => `${agency}/sites/${foreignSite}`, { city: 'Kribi' }, { 'if-match': '1' });
      await assertHidden('deactivate site', 'POST', agency => `${agency}/sites/${foreignSite}/deactivate`);
      await assertHidden('reactivate site', 'POST', agency => `${agency}/sites/${foreignSite}/reactivate`);
      await assertHidden('list sites', 'GET', agency => `${agency}/sites`);

      // Deactivation and reactivation.
      assert.equal((await siteAction(sitesAgency, depot.id, 'deactivate', agentAccess)).status, 403, 'an agent cannot deactivate');
      const off = await siteAction(sitesAgency, depot.id, 'deactivate', adminAccess);
      assert.equal(off.status, 200, 'an administrator deactivates a site');
      const offBody = await off.json();
      assert.deepEqual([offBody.status, offBody.deactivatedAt === null, offBody.version], ['inactive', false, 2]);
      await problemOf(await siteAction(sitesAgency, depot.id, 'deactivate', ownerAccess), 409, 'SITE_DEACTIVATED', 'deactivating twice');
      await problemOf(await patchSite(sitesAgency, depot.id, ownerAccess, { city: 'Edéa' }, '2'), 409, 'SITE_DEACTIVATED', 'editing a deactivated site');
      assert.equal((await agencyPool.query('SELECT count(*)::int AS total FROM agency_sites WHERE id = $1', [depot.id])).rows[0].total, 1, 'a deactivated site is kept');
      assert.equal((await createSite(sitesAgency, ownerAccess, { name: 'dépôt bonabéri', city: 'Douala', address: 'Zone industrielle' })).status, 201, 'a deactivated site frees its name');
      await problemOf(await siteAction(sitesAgency, depot.id, 'reactivate', ownerAccess), 409, 'SITE_NAME_TAKEN', 'reactivating over a taken name');
      await problemOf(await siteAction(sitesAgency, site.id, 'reactivate', ownerAccess), 409, 'SITE_ALREADY_ACTIVE', 'reactivating an active site');
      assert.equal((await siteAction(sitesAgency, depot.id, 'reactivate', agentAccess)).status, 403, 'an agent cannot reactivate');
      const removedTwin = (await agencyPool.query("SELECT id FROM agency_sites WHERE agency_id = $1 AND name = 'dépôt bonabéri'", [sitesAgency])).rows[0].id;
      assert.equal((await siteAction(sitesAgency, removedTwin, 'deactivate', ownerAccess)).status, 200);
      const back = await siteAction(sitesAgency, depot.id, 'reactivate', ownerAccess);
      assert.equal(back.status, 200, 'a deactivated site comes back once its name is free');
      assert.deepEqual([(await back.json()).status, (await agencyPool.query('SELECT version FROM agency_sites WHERE id = $1', [depot.id])).rows[0].version], ['active', 3]);

      // Site list: every member reads it, paginated.
      const pagedSites = await configAgency();
      await agencyPool.query("INSERT INTO agency_sites (id, agency_id, name, name_key, city, address, created_at) SELECT gen_random_uuid(), $1, 'Site ' || lpad(n::text, 2, '0'), 'site ' || lpad(n::text, 2, '0'), 'Douala', 'Rue du Marché, Akwa', now() FROM generate_series(1, 25) n", [pagedSites]);
      await agencyPool.query("UPDATE agency_sites SET deactivated_at = now() WHERE agency_id = $1 AND name = 'Site 02'", [pagedSites]);
      const seenSites = [];
      let siteCursor = null;
      const siteSizes = [];
      for (let guard = 0; guard < 10; guard++) {
        const response = await act('GET', `${pagedSites}/sites?limit=20${siteCursor ? `&cursor=${siteCursor}` : ''}`, agentAccess);
        assert.equal(response.status, 200, 'an agent reads the sites');
        assert.match(response.headers.get('cache-control'), /no-store/);
        const page = await response.json();
        siteSizes.push([page.items.length, page.hasMore]);
        seenSites.push(...page.items);
        if (!page.hasMore) { assert.equal(page.nextCursor, null); break; }
        siteCursor = page.nextCursor;
      }
      assert.deepEqual(siteSizes, [[20, true], [5, false]], '25 sites: 20 then 5');
      assert.deepEqual(seenSites.map(item => item.status), [...Array(24).fill('active'), 'inactive'], 'active sites first');
      assert.deepEqual(seenSites.slice(0, 3).map(item => item.name), ['Site 01', 'Site 03', 'Site 04'], 'ordered by name');
      assert.deepEqual(Object.keys(seenSites[0]).sort(), ['address', 'city', 'createdAt', 'deactivatedAt', 'id', 'name', 'phone', 'status', 'version']);
      for (const limit of ['0', '101', 'abc']) assert.equal((await act('GET', `${pagedSites}/sites?limit=${limit}`, ownerAccess)).status, 400, `site limit ${limit}`);
      assert.equal((await act('GET', `${pagedSites}/sites?cursor=nope`, ownerAccess)).status, 400, 'invalid site cursor');
      await assert.rejects(agencyPool.query("INSERT INTO agency_sites (id, agency_id, name, name_key, city, address, created_at) VALUES ($1, $2, 'site 05', 'site 05', 'Douala', 'Rue du Marché', now())", [randomUUID(), pagedSites]), /agency_sites_active_name_unique/, 'the database refuses two active sites with one name');
      await assert.rejects(agencyPool.query("INSERT INTO agency_sites (id, agency_id, name, name_key, city, address, phone, created_at) VALUES ($1, $2, 'Site 99', 'site 99', 'Douala', 'Rue du Marché', '0677', now())", [randomUUID(), pagedSites]), /agency_sites_phone_format/, 'the database refuses a malformed phone');
      await assert.rejects(agencyPool.query("INSERT INTO agency_sites (id, agency_id, name, name_key, city, address, created_at) VALUES ($1, $2, 'S', 's', 'Douala', 'Rue du Marché', now())", [randomUUID(), pagedSites]), /agency_sites_name_length/, 'the database refuses a short name');
      await agencyPool.query("INSERT INTO agency_sites (id, agency_id, name, name_key, city, address, created_at, deactivated_at) VALUES ($1, $2, 'Site 05', 'site 05', 'Douala', 'Rue du Marché', now(), now())", [randomUUID(), pagedSites]);

      // Capabilities
      const capsAgency = await configAgency();
      activeOne = capsAgency;
      const toggle = (agency, type, action, access, body) => act('POST', `${agency}/capabilities/${type}/${action}`, access, body);
      const enable = (agency, type, access) => toggle(agency, type, 'activate', access);
      const suspend = (agency, type, access, reason = 'Inventaire annuel') => toggle(agency, type, 'suspend', access, { reason });
      const missing = async (response, element, message) => assert.deepEqual((await problemOf(response, 400, 'CAPABILITY_PREREQUISITE_MISSING', message)).missing, [element], message);
      await missing(await enable(capsAgency, 'delivery', adminAccess), 'active_zone', 'delivery without a zone');
      await missing(await enable(capsAgency, 'storage', ownerAccess), 'active_site', 'storage without a site');
      for (const type of ['air', 'DELIVERY', 'hybrid', 'delivery%20']) assert.equal((await enable(capsAgency, type, ownerAccess)).status, 400, `unknown capability ${type}`);
      assert.equal((await act('POST', `${capsAgency}/capabilities/delivery/activate`, ownerAccess, { capability: 'storage' })).status, 400, 'no body is expected');
      assert.equal((await agencyPool.query('SELECT count(*)::int AS total FROM agency_capability_transitions WHERE agency_id = $1', [capsAgency])).rows[0].total, 0, 'refusals wrote nothing');
      assert.equal((await enable(capsAgency, 'delivery', agentAccess)).status, 403, 'an agent cannot enable');
      await assertHidden('enable capability', 'POST', agency => `${agency}/capabilities/delivery/activate`);
      await assertHidden('suspend capability', 'POST', agency => `${agency}/capabilities/delivery/suspend`, { reason: 'Inventaire annuel' });

      assert.equal((await addZone(capsAgency, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 201);
      assert.equal((await enable(capsAgency, 'storage', ownerAccess)).status, 400, 'a zone is not enough for storage');
      const delivering = await enable(capsAgency, 'delivery', adminAccess);
      assert.equal(delivering.status, 200, 'an administrator enables delivery');
      assert.match(delivering.headers.get('cache-control'), /no-store/);
      const deliveringBody = await delivering.json();
      assert.deepEqual(deliveringBody.capabilities.map(({ since, ...rest }) => rest), [{ type: 'delivery', state: 'active', reason: null, acceptsNewRequests: true }]);
      assert.ok(Number.isFinite(Date.parse(deliveringBody.capabilities[0].since)));
      assert.equal(deliveringBody.hybrid, false);
      await problemOf(await enable(capsAgency, 'delivery', ownerAccess), 409, 'CAPABILITY_ALREADY_ACTIVE', 'enabling twice');
      assert.equal((await configAudit(capsAgency)).filter(entry => entry.action === 'agency.capability_enabled').length, 1, 'one audit row, no second trace');
      await problemOf(await suspend(capsAgency, 'storage', ownerAccess), 409, 'CAPABILITY_NOT_ACTIVE', 'suspending a capability never enabled');
      await problemOf(await retireZone(capsAgency, (await zoneRows(capsAgency))[0].id, ownerAccess), 409, 'LAST_ACTIVE_ZONE', 'the last zone stays while delivery is active');
      assert.equal((await zoneRows(capsAgency))[0].retired_at, null);

      assert.equal((await createSite(capsAgency, ownerAccess, { name: 'Dépôt Bonabéri', city: 'Douala', address: 'Zone industrielle de Bonabéri' })).status, 201);
      const depotId = (await agencyPool.query('SELECT id FROM agency_sites WHERE agency_id = $1', [capsAgency])).rows[0].id;
      const hybrid = await (await enable(capsAgency, 'storage', ownerAccess)).json();
      assert.deepEqual([hybrid.capabilities.map(item => item.type), hybrid.hybrid], [['delivery', 'storage'], true], 'both capabilities make the agency hybrid');
      await problemOf(await siteAction(capsAgency, depotId, 'deactivate', ownerAccess), 409, 'LAST_ACTIVE_SITE', 'the last site stays while storage is active');
      assert.equal((await agencyPool.query('SELECT deactivated_at FROM agency_sites WHERE id = $1', [depotId])).rows[0].deactivated_at, null);

      const state = await (await getOnboarding(agentAccess, capsAgency)).json();
      assert.deepEqual([state.hybrid, state.activeZones, state.activeSites, state.capabilities.map(item => [item.type, item.state, item.acceptsNewRequests])], [true, 1, 1, [['delivery', 'active', true], ['storage', 'active', true]]], 'the onboarding state shows the real configuration');
      assert.deepEqual(state.prerequisites.filter(item => item.filled).map(item => item.code), ['active_capability', 'active_site']);

      assert.equal((await suspend(capsAgency, 'storage', agentAccess)).status, 403, 'an agent cannot suspend');
      for (const body of [{}, { reason: '' }, { reason: 'ok' }, { reason: '   ab  ' }, { reason: 'x'.repeat(501) }, { reason: 5 }, { reason: 'Motif\u0000' }, { reason: 'Inventaire annuel', extra: true }]) {
        assert.equal((await toggle(capsAgency, 'storage', 'suspend', ownerAccess, body)).status, 400, `suspension refused ${JSON.stringify(body).slice(0, 50)}`);
      }
      assert.equal((await toggle(capsAgency, 'air', 'suspend', ownerAccess, { reason: 'Inventaire annuel' })).status, 400, 'suspending an unknown capability');
      assert.equal((await act('POST', `${capsAgency}/capabilities/storage/suspend`, ownerAccess)).status, 400, 'a reason is required');
      assert.equal((await suspend(capsAgency, 'storage', ownerAccess, 'abc')).status, 200, 'a reason of 3 characters');
      assert.equal((await enable(capsAgency, 'storage', ownerAccess)).status, 200, 'a suspended capability is enabled again by the same action');
      const suspended = await suspend(capsAgency, 'storage', adminAccess, ' Inventaire annuel ');
      assert.equal(suspended.status, 200, 'an administrator suspends storage');
      const suspendedBody = await suspended.json();
      const storage = suspendedBody.capabilities.find(item => item.type === 'storage');
      assert.deepEqual([storage.state, storage.reason, storage.acceptsNewRequests, suspendedBody.hybrid], ['suspended', 'Inventaire annuel', false, false]);
      assert.equal(suspendedBody.capabilities.find(item => item.type === 'delivery').state, 'active', 'the other capability is untouched');
      await problemOf(await suspend(capsAgency, 'storage', ownerAccess, 'Autre motif'), 409, 'CAPABILITY_NOT_ACTIVE', 'suspending twice');
      assert.equal((await suspend(capsAgency, 'storage', ownerAccess, 'x'.repeat(500))).status, 409, 'a 500 character reason is valid, the state is what refuses');
      const suspendedState = await (await getOnboarding(ownerAccess, capsAgency)).json();
      assert.deepEqual(suspendedState.capabilities.find(item => item.type === 'storage'), { type: 'storage', state: 'suspended', since: suspendedState.capabilities.find(item => item.type === 'storage').since, reason: 'Inventaire annuel', acceptsNewRequests: false });
      assert.equal((await siteAction(capsAgency, depotId, 'deactivate', ownerAccess)).status, 200, 'the last site can go once storage is suspended');
      await missing(await enable(capsAgency, 'storage', ownerAccess), 'active_site', 'a suspended capability is enabled again only with its configuration');
      assert.equal((await siteAction(capsAgency, depotId, 'reactivate', ownerAccess)).status, 200);
      assert.equal((await enable(capsAgency, 'storage', ownerAccess)).status, 200, 'enabled again');
      const history = await agencyPool.query("SELECT type, kind, sequence, reason FROM agency_capability_transitions WHERE agency_id = $1 AND type = 'storage' ORDER BY sequence", [capsAgency]);
      assert.deepEqual(history.rows.map(row => [row.kind, row.sequence, row.reason]), [['activated', 1, null], ['suspended', 2, 'abc'], ['activated', 3, null], ['suspended', 4, 'Inventaire annuel'], ['activated', 5, null]], 'the history of the capability is kept');
      assert.equal((await retireZone(capsAgency, (await zoneRows(capsAgency))[0].id, ownerAccess)).status === 409, true, 'delivery still protects its last zone');

      assert.equal((await suspend(capsAgency, 'delivery', ownerAccess)).status, 200, 'the last capability of a kind can be suspended');
      assert.equal((await retireZone(capsAgency, (await zoneRows(capsAgency))[0].id, ownerAccess)).status, 200, 'the last zone can go once delivery is suspended');
      await missing(await enable(capsAgency, 'delivery', ownerAccess), 'active_zone', 'delivery without a zone again');
      assert.equal((await addZone(capsAgency, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 201, 'the zone comes back');
      assert.equal((await enable(capsAgency, 'delivery', ownerAccess)).status, 200, 'and so does delivery');

      await assert.rejects(agencyPool.query("INSERT INTO agency_capability_transitions (agency_id, type, sequence, kind, reason, actor_id, occurred_at) VALUES ($1, 'delivery', 1, 'activated', NULL, $2, now())", [capsAgency, account.id]), /agency_capability_transitions_pkey/, 'the database refuses two transitions with one sequence');
      await assert.rejects(agencyPool.query("INSERT INTO agency_capability_transitions (agency_id, type, sequence, kind, reason, actor_id, occurred_at) VALUES ($1, 'delivery', 99, 'suspended', NULL, $2, now())", [capsAgency, account.id]), /agency_capability_transitions_reason_matches_kind/, 'a suspension needs a reason');
      await assert.rejects(agencyPool.query("INSERT INTO agency_capability_transitions (agency_id, type, sequence, kind, reason, actor_id, occurred_at) VALUES ($1, 'air', 1, 'activated', NULL, $2, now())", [capsAgency, account.id]), /agency_capability_transitions_type_valid/, 'only two capabilities exist');

      // The configuration stays editable once the agency is submitted.
      const submittedAgency = await configAgency();
      await agencyPool.query("UPDATE agencies SET status = 'submitted', submitted_at = now(), submitted_by = $2 WHERE id = $1", [submittedAgency, account.id]);
      assert.equal((await addZone(submittedAgency, adminAccess, { city: 'Douala', district: 'Bépanda' })).status, 201, 'a zone on a submitted agency');
      assert.equal((await createSite(submittedAgency, adminAccess, { name: 'Comptoir Deïdo', city: 'Douala', address: 'Rue de Deïdo, face Total' })).status, 201, 'a site on a submitted agency');
      assert.equal((await enable(submittedAgency, 'delivery', adminAccess)).status, 200, 'a capability on a submitted agency');
      assert.equal((await suspend(submittedAgency, 'delivery', adminAccess)).status, 200, 'and its suspension');
      assert.equal((await getOnboarding(ownerAccess, submittedAgency).then(response => response.json())).status, 'submitted', 'the status did not move');

      // Concurrency: the lock on the agency row serializes every configuration write.
      const double = await configAgency();
      assert.equal((await addZone(double, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 201);
      const twinEnables = await Promise.all([enable(double, 'delivery', ownerAccess), enable(double, 'delivery', adminAccess)]);
      assert.deepEqual(twinEnables.map(response => response.status).sort(), [200, 409], 'two simultaneous activations: one wins');
      assert.equal((await configAudit(double)).filter(entry => entry.action === 'agency.capability_enabled').length, 1, 'one activation is audited');
      assert.equal((await agencyPool.query("SELECT count(*)::int AS total FROM agency_capability_transitions WHERE agency_id = $1 AND kind = 'activated'", [double])).rows[0].total, 1, 'one activation is stored');
      const twinSuspensions = await Promise.all([suspend(double, 'delivery', ownerAccess), suspend(double, 'delivery', adminAccess)]);
      assert.deepEqual(twinSuspensions.map(response => response.status).sort(), [200, 409], 'two simultaneous suspensions: one wins');
      assert.equal((await configAudit(double)).filter(entry => entry.action === 'agency.capability_suspended').length, 1, 'one suspension is audited');
      const sameZone = await configAgency();
      const twinZones = await Promise.all([addZone(sameZone, ownerAccess, { city: 'Douala', district: 'Deïdo' }), addZone(sameZone, adminAccess, { city: 'DOUALA', district: 'DEÏDO' })]);
      assert.deepEqual(twinZones.map(response => response.status).sort(), [201, 409], 'two simultaneous additions of one zone: one wins');
      assert.equal((await zoneRows(sameZone)).length, 1, 'one zone');
      const sameSite = await configAgency();
      const twinSites = await Promise.all([createSite(sameSite, ownerAccess, { name: 'Agence Akwa', city: 'Douala', address: 'Rue Joss, Akwa' }), createSite(sameSite, adminAccess, { name: 'AGENCE akwa', city: 'Douala', address: 'Rue Joss, Akwa' })]);
      assert.deepEqual(twinSites.map(response => response.status).sort(), [201, 409], 'two simultaneous creations of one site: one wins');
      assert.equal((await agencyPool.query('SELECT count(*)::int AS total FROM agency_sites WHERE agency_id = $1', [sameSite])).rows[0].total, 1, 'one site');
      for (let round = 0; round < 4; round++) {
        const lastZone = await configAgency();
        const zone = await (await addZone(lastZone, ownerAccess, { city: 'Douala', district: 'Akwa' })).json();
        const [activation, removal] = await Promise.all([enable(lastZone, 'delivery', ownerAccess), retireZone(lastZone, zone.id, adminAccess)]);
        assert.ok((activation.status === 200 && removal.status === 409) || (activation.status === 400 && removal.status === 200), `round ${round}: the last zone against delivery: ${activation.status}/${removal.status}`);
        const delivery = await agencyPool.query("SELECT (SELECT kind FROM agency_capability_transitions WHERE agency_id = $1 AND type = 'delivery' ORDER BY sequence DESC LIMIT 1) AS kind, (SELECT count(*)::int FROM service_zones WHERE agency_id = $1 AND retired_at IS NULL) AS zones", [lastZone]);
        assert.ok(!(delivery.rows[0].kind === 'activated' && delivery.rows[0].zones === 0), `round ${round}: delivery is never active without a zone`);
        const lastSite = await configAgency();
        const lastSiteId = (await (await createSite(lastSite, ownerAccess, { name: 'Dépôt Bonabéri', city: 'Douala', address: 'Zone industrielle de Bonabéri' })).json()).id;
        const [storing, closing] = await Promise.all([enable(lastSite, 'storage', ownerAccess), siteAction(lastSite, lastSiteId, 'deactivate', adminAccess)]);
        assert.ok((storing.status === 200 && closing.status === 409) || (storing.status === 400 && closing.status === 200), `round ${round}: the last site against storage: ${storing.status}/${closing.status}`);
        const storage = await agencyPool.query("SELECT (SELECT kind FROM agency_capability_transitions WHERE agency_id = $1 AND type = 'storage' ORDER BY sequence DESC LIMIT 1) AS kind, (SELECT count(*)::int FROM agency_sites WHERE agency_id = $1 AND deactivated_at IS NULL) AS sites", [lastSite]);
        assert.ok(!(storage.rows[0].kind === 'activated' && storage.rows[0].sites === 0), `round ${round}: storage is never active without a site`);
      }

      // B2.5: submission to verification, and B2.10: the members of an agency.
      const submit = (agency, access, body, headers) => act('POST', `${agency}/submit`, access, body, headers);
      const FULL_IDENTITY = { legalName: 'Express Douala SARL', headquartersCity: 'Douala', headquartersAddress: 'Rue Joss, Akwa', primaryPhone: '677123456' };
      const PREREQUISITES = ['legal_name', 'headquarters_city', 'headquarters_address', 'primary_phone', 'active_capability', 'active_site'];
      const FIELD_OF = { legal_name: 'legalName', headquarters_city: 'headquartersCity', headquarters_address: 'headquartersAddress', primary_phone: 'primaryPhone' };
      const versionOf = async (agency) => String((await (await getAgency(ownerAccess, agency)).json()).version);
      const stateOf = async (agency) => (await getOnboarding(ownerAccess, agency)).json();
      const submissionRow = async (agency) => (await agencyPool.query('SELECT status, submitted_at, submitted_by, version, legal_name FROM agencies WHERE id = $1', [agency])).rows[0];
      const submissionAudit = async (agency) => (await agencyPool.query("SELECT user_id, details FROM identity_audit WHERE agency_id = $1 AND action = 'agency.submitted'", [agency])).rows;
      /** A draft built through the real routes; `without` leaves out one prerequisite. */
      const prepared = async (without = null) => {
        const agency = await configAgency();
        const identity = Object.fromEntries(Object.entries(FULL_IDENTITY).filter(([field]) => field !== FIELD_OF[without]));
        if (Object.keys(identity).length > 0) assert.equal((await patchAgency(`${agency}/identity`, ownerAccess, identity, await versionOf(agency))).status, 200, 'identity of the prepared agency');
        if (without !== 'active_capability') {
          assert.equal((await addZone(agency, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 201);
          assert.equal((await enable(agency, 'delivery', ownerAccess)).status, 200);
        }
        if (without !== 'active_site') assert.equal((await createSite(agency, ownerAccess, { name: 'Agence Akwa', city: 'Douala', address: 'Rue Joss, Akwa' })).status, 201);
        return agency;
      };
      let submissions = 0;

      const complete = await prepared();
      activeOne = complete;
      assert.equal((await stateOf(complete)).readyForSubmission, true, 'the prepared agency is ready');
      await assertHidden('submit', 'POST', agency => `${agency}/submit`);
      for (const [who, access] of [['an administrator', adminAccess], ['an agent', agentAccess]]) {
        await problemOf(await submit(complete, access), 403, undefined, `${who} cannot submit`);
      }
      for (const body of [{ status: 'approved' }, { agencyId: unknownAgency }, { submittedBy: adminUser }, { reason: 'x' }]) assert.equal((await submit(complete, ownerAccess, body)).status, 400, `a body is refused: ${JSON.stringify(body)}`);
      assert.deepEqual([(await submissionRow(complete)).status, (await submissionAudit(complete)).length], ['draft', 0], 'refusals changed nothing');

      // Incomplete dossiers: the refusal lists everything that is missing.
      const empty = await configAgency();
      const refusal = await problemOf(await submit(empty, ownerAccess), 400, 'SUBMISSION_INCOMPLETE', 'an empty draft cannot be submitted');
      assert.deepEqual(refusal.missing, PREREQUISITES, 'every prerequisite is listed, in the order of the onboarding state');
      for (const lacking of PREREQUISITES) {
        const agency = await prepared(lacking);
        const before = await versionOf(agency);
        assert.deepEqual((await problemOf(await submit(agency, ownerAccess), 400, 'SUBMISSION_INCOMPLETE', `without ${lacking}`)).missing, [lacking], `only ${lacking} is listed`);
        assert.deepEqual([(await submissionRow(agency)).status, (await submissionAudit(agency)).length, await versionOf(agency)], ['draft', 0, before], `without ${lacking}: still a draft, no trace`);
      }
      const suspendedOnly = await prepared();
      assert.equal((await suspend(suspendedOnly, 'delivery', ownerAccess)).status, 200);
      assert.deepEqual((await problemOf(await submit(suspendedOnly, ownerAccess), 400, 'SUBMISSION_INCOMPLETE', 'a suspended capability does not count')).missing, ['active_capability']);
      const twoMissing = await prepared('primary_phone');
      const siteOfTwo = (await agencyPool.query('SELECT id FROM agency_sites WHERE agency_id = $1', [twoMissing])).rows[0].id;
      assert.equal((await siteAction(twoMissing, siteOfTwo, 'deactivate', ownerAccess)).status, 200);
      assert.deepEqual((await problemOf(await submit(twoMissing, ownerAccess), 400, 'SUBMISSION_INCOMPLETE', 'two missing')).missing, ['primary_phone', 'active_site'], 'several missing prerequisites at once');

      // Nominal submission.
      const versionBefore = await versionOf(complete);
      const first = await submit(complete, ownerAccess);
      assert.equal(first.status, 200, 'the owner submits a complete agency');
      assert.match(first.headers.get('cache-control'), /no-store/);
      submissions += 1;
      const submittedBody = await first.json();
      assert.deepEqual({ ...submittedBody, submission: { ...submittedBody.submission, submittedAt: undefined } }, { status: 'submitted', submission: { submittedAt: undefined, submittedBy: account.id } });
      assert.ok(Number.isFinite(Date.parse(submittedBody.submission.submittedAt)));
      const stored = await submissionRow(complete);
      assert.deepEqual([stored.status, stored.submitted_by, stored.submitted_at.toISOString()], ['submitted', account.id, submittedBody.submission.submittedAt], 'date and author are stored');
      assert.equal(await versionOf(complete), versionBefore, 'the version of the agency does not move');
      const submittedState = await stateOf(complete);
      assert.deepEqual([submittedState.status, submittedState.submission, submittedState.readyForSubmission], ['submitted', submittedBody.submission, false], 'the onboarding state shows the submission');
      assert.equal(/verified|certified|insured|approved/i.test(JSON.stringify(submittedState)), false, 'a submitted agency is not presented as verified');
      assert.equal((await (await getAgency(ownerAccess, complete)).json()).status, 'submitted');
      assert.deepEqual(await submissionAudit(complete), [{ user_id: account.id, details: null }], 'one audit row, no value of the agency');

      // A second submission is a conflict, with no second effect; the rights are checked first.
      await problemOf(await submit(complete, ownerAccess), 409, 'AGENCY_ALREADY_SUBMITTED', 'a second submission');
      await problemOf(await submit(complete, adminAccess), 403, undefined, 'an administrator is refused before the status is looked at');
      const afterSecond = await submissionRow(complete);
      assert.deepEqual([afterSecond.submitted_at.toISOString(), afterSecond.submitted_by, (await submissionAudit(complete)).length], [stored.submitted_at.toISOString(), account.id, 1], 'date, author and trace are those of the first submission');

      // Once submitted: identity locked through the real route, everything else still editable.
      const lockedIdentity = await patchAgency(`${complete}/identity`, ownerAccess, { legalName: 'Autre raison sociale' }, await versionOf(complete));
      assert.equal(lockedIdentity.status, 409, 'the identity of a submitted agency is locked');
      assert.equal((await submissionRow(complete)).legal_name, FULL_IDENTITY.legalName, 'the locked identity is untouched');
      assert.equal((await patchAgency(`${complete}/profile`, adminAccess, { description: 'Livraison et stockage à Douala' }, await versionOf(complete))).status, 200, 'the profile stays editable');
      assert.equal((await addZone(complete, adminAccess, { city: 'Yaoundé', district: null })).status, 201, 'zones stay editable');
      assert.equal((await createSite(complete, adminAccess, { name: 'Dépôt Bonabéri', city: 'Douala', address: 'Zone industrielle de Bonabéri' })).status, 201, 'sites stay editable');
      assert.equal((await enable(complete, 'storage', adminAccess)).status, 200, 'capabilities stay editable');
      assert.equal((await suspend(complete, 'delivery', adminAccess)).status, 200, 'and suspendable');
      assert.deepEqual([(await stateOf(complete)).status, (await submissionRow(complete)).status], ['submitted', 'submitted'], 'nothing moves the status back');

      // Concurrency: the lock on the agency makes one of two simultaneous submissions win.
      for (let round = 0; round < 3; round++) {
        const raced = await prepared();
        const twins = await Promise.all([submit(raced, ownerAccess), submit(raced, ownerAccess)]);
        assert.deepEqual(twins.map(response => response.status).sort(), [200, 409], `round ${round}: one submission wins`);
        submissions += 1;
        assert.equal((await submissionAudit(raced)).length, 1, `round ${round}: one audit row`);
      }
      for (let round = 0; round < 3; round++) {
        const raced = await prepared();
        const [submitted, edited] = await Promise.all([submit(raced, ownerAccess), patchAgency(`${raced}/identity`, adminAccess, { legalName: 'Nom concurrent' }, await versionOf(raced))]);
        assert.equal(submitted.status, 200, `round ${round}: the submission of a complete agency succeeds`);
        submissions += 1;
        assert.ok([200, 409].includes(edited.status), `round ${round}: the identity edit is either before the submission or refused: ${edited.status}`);
        const row = await submissionRow(raced);
        assert.equal(row.legal_name, edited.status === 200 ? 'Nom concurrent' : FULL_IDENTITY.legalName, `round ${round}: the identity is what the winner of the lock left`);
        assert.equal(row.status, 'submitted');
      }
      assert.equal((await agencyPool.query("SELECT count(*)::int AS total FROM identity_audit WHERE action = 'agency.submitted'")).rows[0].total, submissions, 'one audit row per successful submission, none for refusals');
      assert.equal(JSON.stringify((await agencyPool.query("SELECT * FROM identity_audit WHERE action = 'agency.submitted'")).rows).includes('Douala'), false, 'the submission audit holds no value of the agency');

      // The members of an agency.
      const teamAgency = await configAgency();
      activeOne = teamAgency;
      const listMembers = (agency, access, query = '') => fetch(`${api}/agencies/${agency}/members${query}`, { headers: authHeaders(access) });
      const activeMembers = (await agencyPool.query('SELECT id, user_id, role FROM agency_memberships WHERE agency_id = $1 AND active ORDER BY id', [teamAgency])).rows;
      const expectedMembers = activeMembers.map(row => ({ membershipId: row.id, userId: row.user_id, role: row.role }));
      assert.equal(expectedMembers.length, 3);
      for (const [who, access] of [['the owner', ownerAccess], ['an administrator', adminAccess], ['an agent', agentAccess]]) {
        const response = await listMembers(teamAgency, access);
        assert.equal(response.status, 200, `${who} lists the members`);
        assert.match(response.headers.get('cache-control'), /no-store/);
        assert.deepEqual(await response.json(), { items: expectedMembers, nextCursor: null, hasMore: false }, `${who} sees the active members, with the identifiers and the role only`);
      }
      await assertHidden('list members', 'GET', agency => `${agency}/members`);
      const collected = [];
      let cursor = null;
      for (let page = 0; page < 3; page++) {
        const response = await listMembers(teamAgency, ownerAccess, `?limit=1${cursor ? `&cursor=${cursor}` : ''}`);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.items.length, 1, `page ${page}`);
        assert.equal(body.hasMore, page < 2, `page ${page}: hasMore`);
        assert.equal(body.nextCursor, page < 2 ? body.items[0].membershipId : null, `page ${page}: the cursor is the last membership`);
        collected.push(...body.items);
        cursor = body.nextCursor;
      }
      assert.deepEqual(collected, expectedMembers, 'the pages cover the members once each, in order');
      const twoPerPage = await (await listMembers(teamAgency, ownerAccess, '?limit=2')).json();
      assert.deepEqual([twoPerPage.items.length, twoPerPage.hasMore], [2, true]);
      for (const query of ['?limit=0', '?limit=101', '?limit=abc', '?limit=1.5', '?cursor=not-a-uuid']) assert.equal((await listMembers(teamAgency, ownerAccess, query)).status, 400, `invalid query ${query}`);
      const beyond = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      assert.deepEqual(await (await listMembers(teamAgency, ownerAccess, `?cursor=${beyond}`)).json(), { items: [], nextCursor: null, hasMore: false }, 'a member reading past the last row gets an empty page');
      for (const [who, access] of [['an outsider', outsiderAccess], ['a former member', formerAccess]]) assert.equal((await listMembers(teamAgency, access, `?cursor=${beyond}`)).status, 404, `${who} finds nothing, cursor or not`);
      await agencyPool.query('UPDATE agency_memberships SET active = false WHERE id = $1', [activeMembers.find(row => row.user_id === invitedUser).id]);
      assert.equal((await listMembers(teamAgency, agentAccess)).status, 404, 'a member who lost access cannot list');
      const remaining = await (await listMembers(teamAgency, ownerAccess)).json();
      assert.deepEqual(remaining.items.map(item => item.userId).sort(), [account.id, adminUser].sort(), 'a former member is no longer listed');
      assert.ok(!JSON.stringify(remaining).includes('@'), 'no e-mail address is exposed');

      // B3.2: correct a zone (same identifier), B2.13 limits and refused characters, B2.13 membership checked before the lock.
      {
        const fixAgency = await configAgency();
        const previousActive = activeOne;
        activeOne = fixAgency;
        const patchZone = (agency, zone, access, body) => act('PATCH', `${agency}/zones/${zone}`, access, body);
        const zoneOf = async (agency, access, body) => (await (await addZone(agency, access, body)).json());
        const akwaa = await zoneOf(fixAgency, ownerAccess, { city: 'Douala', district: 'Akwaa' });
        const deido = await zoneOf(fixAgency, ownerAccess, { city: 'Douala', district: 'Deïdo' });
        const bepanda = await zoneOf(fixAgency, ownerAccess, { city: 'Douala', district: 'Bépanda' });
        assert.equal((await retireZone(fixAgency, bepanda.id, ownerAccess)).status, 200);
        const renamedAudit = async (agency) => (await agencyPool.query("SELECT user_id, resource_id, details FROM identity_audit WHERE agency_id = $1 AND action = 'agency.zone_renamed' ORDER BY occurred_at, id", [agency])).rows;
        const zoneRow = async (zone) => (await agencyPool.query('SELECT id, agency_id, city, district, city_key, district_key, retired_at FROM service_zones WHERE id = $1', [zone])).rows[0];

        // 200 with the same identifier; an administrator may, the audit names the zone and the field only.
        const corrected = await patchZone(fixAgency, akwaa.id, adminAccess, { city: 'Douala', district: 'Akwa' });
        assert.equal(corrected.status, 200, 'an administrator corrects a zone');
        assert.match(corrected.headers.get('cache-control'), /no-store/);
        const correctedBody = await corrected.json();
        assert.deepEqual([correctedBody.id, correctedBody.city, correctedBody.district, correctedBody.status, correctedBody.addedAt, correctedBody.retiredAt], [akwaa.id, 'Douala', 'Akwa', 'active', akwaa.addedAt, null]);
        assert.deepEqual(await zoneRow(akwaa.id), { id: akwaa.id, agency_id: fixAgency, city: 'Douala', district: 'Akwa', city_key: 'douala', district_key: 'akwa', retired_at: null }, 'same row, new spelling and new comparison keys');
        assert.equal((await zoneRows(fixAgency)).length, 3, 'no zone was created');
        assert.deepEqual(await renamedAudit(fixAgency), [{ user_id: adminUser, resource_id: akwaa.id, details: { fields: ['district'] } }]);
        const listed = await (await act('GET', `${fixAgency}/zones`, agentAccess)).json();
        assert.equal(listed.items.find(item => item.id === akwaa.id).district, 'Akwa', 'the list shows the new spelling');

        // Identical body: 200, nothing written, no trace. Case or accent alone is a correction.
        const same = await patchZone(fixAgency, akwaa.id, ownerAccess, { city: ' Douala ', district: 'Akwa' });
        assert.equal(same.status, 200);
        assert.equal((await same.json()).id, akwaa.id);
        assert.equal((await renamedAudit(fixAgency)).length, 1, 'an unchanged zone leaves no trace');
        assert.equal((await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'douala', district: 'AKWÁ' })).status, 200, 'a correction of case and accent alone');
        assert.equal((await zoneRow(akwaa.id)).district, 'AKWÁ');
        assert.equal((await renamedAudit(fixAgency)).length, 2);
        assert.equal((await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 200);
        const wholeCityFix = await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'Douala', district: null });
        assert.deepEqual([wholeCityFix.status, (await wholeCityFix.json()).district, (await zoneRow(akwaa.id)).district_key], [200, null, ''], 'no district: the whole city');
        assert.equal((await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 200);
        assert.equal((await renamedAudit(fixAgency)).length, 5, 'one trace per effective correction');

        // Conflicts: another zone of the agency, active or retired; a retired zone is not corrected. Nothing is written or traced.
        const auditBefore = (await renamedAudit(fixAgency)).length;
        await problemOf(await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'douala', district: 'DEIDO' }), 409, 'ZONE_ALREADY_SERVED', 'towards an active zone');
        await problemOf(await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'Douala', district: 'Bépanda' }), 409, 'ZONE_RETIRED_DUPLICATE', 'towards a retired zone');
        await problemOf(await patchZone(fixAgency, bepanda.id, ownerAccess, { city: 'Douala', district: 'Bépanda Omnisport' }), 409, 'ZONE_RETIRED', 'a retired zone');
        assert.deepEqual([(await zoneRow(akwaa.id)).district, (await zoneRow(bepanda.id)).district, (await zoneRow(bepanda.id)).retired_at === null], ['Akwa', 'Bépanda', false]);
        assert.equal((await renamedAudit(fixAgency)).length, auditBefore, 'a refusal leaves no trace');

        // 400: bounds, characters, strict body.
        const refusedCorrections = [
          { city: 'x' }, { city: 'Douala', district: 'x' }, { city: 'x'.repeat(81) }, { city: 'Douala', district: 'x'.repeat(81) }, { city: '' }, { city: '   ' }, {},
          { city: 'Dou​ala' }, { city: 'Douala', district: 'Ak‮wa' }, { city: 'Dou\u0000ala' }, { city: 'Douala', district: 'Akwa﻿' }, { city: 'Dou\u0007ala' },
          { city: 'Douala', status: 'retired' }, { city: 'Douala', agencyId: fixAgency }, { city: 12 }, { city: 'Douala', district: 12 }, { city: null },
        ];
        for (const body of refusedCorrections) assert.equal((await patchZone(fixAgency, akwaa.id, ownerAccess, body)).status, 400, `correction refused ${JSON.stringify(body).slice(0, 60)}`);
        assert.equal((await act('PATCH', `${fixAgency}/zones/${akwaa.id}`, ownerAccess, ['Douala'])).status, 400, 'a list is not a zone');
        assert.equal((await patchZone(fixAgency, 'not-a-uuid', ownerAccess, { city: 'Douala' })).status, 400, 'invalid zone id');
        assert.equal((await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'xx', district: 'y'.repeat(80) })).status, 200, 'bounds: 2 and 80 characters are accepted');
        assert.equal((await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 200);
        assert.deepEqual([(await zoneRow(akwaa.id)).city, (await zoneRow(akwaa.id)).district], ['Douala', 'Akwa']);

        // 401, 403, 404.
        assert.equal((await patchZone(fixAgency, akwaa.id, agentAccess, { city: 'Douala', district: 'Akwa Nord' })).status, 403, 'an agent cannot correct a zone');
        assert.equal((await zoneRow(akwaa.id)).district, 'Akwa');
        await assertHidden('correct zone', 'PATCH', agency => `${agency}/zones/${akwaa.id}`, { city: 'Douala', district: 'Akwa Nord' });
        const unknownCorrection = withoutEcho(await (await patchZone(fixAgency, randomUUID(), ownerAccess, { city: 'Douala', district: 'Akwa Nord' })).json());
        const foreignCorrection = await patchZone(fixAgency, foreignZone, ownerAccess, { city: 'Douala', district: 'Akwa Nord' });
        assert.equal(foreignCorrection.status, 404, 'a zone of another agency is not found');
        assert.deepEqual(withoutEcho(await foreignCorrection.json()), unknownCorrection, 'same answer as an unknown zone');
        assert.equal((await patchZone(outsiderOwn, foreignZone, ownerAccess, { city: 'Douala', district: 'Akwa Nord' })).status, 404, 'nor through the other agency, whose member the owner is not');
        assert.deepEqual([(await zoneRow(foreignZone)).city, (await zoneRow(foreignZone)).agency_id], ['Bafoussam', outsiderOwn], 'the other agency zone is untouched');
        assert.equal((await patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 200, 'nothing above changed the zone');

        // Concurrency: two corrections towards one spelling keep one zone; two corrections of one zone both succeed.
        const racers = [await zoneOf(fixAgency, ownerAccess, { city: 'Limbé', district: 'Down Beach' }), await zoneOf(fixAgency, ownerAccess, { city: 'Limbé', district: 'Mile 4' })];
        const race = await Promise.all([patchZone(fixAgency, racers[0].id, adminAccess, { city: 'Limbé', district: 'Bota' }), patchZone(fixAgency, racers[1].id, ownerAccess, { city: 'limbe', district: 'BOTA' })]);
        assert.deepEqual(race.map(response => response.status).sort(), [200, 409], 'only one of two simultaneous corrections to one spelling succeeds');
        const losing = race.find(response => response.status === 409);
        assert.equal((await losing.json()).code, 'ZONE_ALREADY_SERVED');
        assert.equal((await agencyPool.query("SELECT count(*)::int AS total FROM service_zones WHERE agency_id = $1 AND city_key = 'limbe' AND district_key = 'bota' AND retired_at IS NULL", [fixAgency])).rows[0].total, 1);
        const sameZoneRace = await Promise.all(['Cap', 'Cape'].map((district, index) => patchZone(fixAgency, deido.id, index === 0 ? adminAccess : ownerAccess, { city: 'Douala', district })));
        assert.deepEqual(sameZoneRace.map(response => response.status), [200, 200], 'two corrections of the same zone: the last one wins, none fails');
        assert.ok(['Cap', 'Cape'].includes((await zoneRow(deido.id)).district));
        assert.equal((await zoneRows(fixAgency)).length, 5);

        // Zone limits: 100 active at once, 300 in all; a reactivation creates no row and is still possible.
        const bulkZones = await configAgency();
        activeOne = bulkZones;
        await agencyPool.query("INSERT INTO service_zones (id, agency_id, city, district, city_key, district_key, added_at, retired_at) SELECT gen_random_uuid(), $1, 'Ville ' || lpad(n::text, 3, '0'), NULL, 'ville ' || lpad(n::text, 3, '0'), '', now() - interval '1 day', CASE WHEN n <= 250 THEN now() ELSE NULL END FROM generate_series(1, 300) n", [bulkZones]);
        await problemOf(await addZone(bulkZones, ownerAccess, { city: 'Kribi' }), 409, 'ZONE_TOTAL_LIMIT_REACHED', 'a 301st zone');
        assert.equal((await zoneRows(bulkZones)).length, 300);
        const revived = await addZone(bulkZones, ownerAccess, { city: 'ville 001' });
        assert.equal(revived.status, 201, 'reactivating a retired zone adds no row');
        assert.equal((await zoneRows(bulkZones)).length, 300);
        const [anyActive] = (await agencyPool.query("SELECT id FROM service_zones WHERE agency_id = $1 AND retired_at IS NULL AND city = 'Ville 300'", [bulkZones])).rows;
        assert.equal((await patchZone(bulkZones, anyActive.id, ownerAccess, { city: 'Douala', district: 'Akwa' })).status, 200, 'a correction is not an addition: it works at the limits');
        assert.equal((await agencyPool.query("SELECT count(*)::int AS total FROM service_zones WHERE agency_id = $1 AND city = 'Douala' AND district = 'Akwa'", [bulkZones])).rows[0].total, 1);

        // Site limits: 50 active at once, 200 in all.
        const bulkSites = await configAgency();
        activeOne = bulkSites;
        const siteBody = (name) => ({ name, city: 'Douala', address: 'Rue du Marché, Akwa' });
        await agencyPool.query("INSERT INTO agency_sites (id, agency_id, name, name_key, city, address, created_at) SELECT gen_random_uuid(), $1, 'Lieu ' || lpad(n::text, 3, '0'), 'lieu ' || lpad(n::text, 3, '0'), 'Douala', 'Rue du Marché, Akwa', now() FROM generate_series(1, 50) n", [bulkSites]);
        await problemOf(await createSite(bulkSites, ownerAccess, siteBody('Lieu 051')), 409, 'SITE_LIMIT_REACHED', 'a 51st active site');
        await agencyPool.query("INSERT INTO agency_sites (id, agency_id, name, name_key, city, address, created_at, deactivated_at) SELECT gen_random_uuid(), $1, 'Ancien ' || lpad(n::text, 3, '0'), 'ancien ' || lpad(n::text, 3, '0'), 'Douala', 'Rue du Marché, Akwa', now() - interval '1 day', now() FROM generate_series(1, 140) n", [bulkSites]);
        const [oldSite] = (await agencyPool.query("SELECT id FROM agency_sites WHERE agency_id = $1 AND name = 'Ancien 001'", [bulkSites])).rows;
        await problemOf(await siteAction(bulkSites, oldSite.id, 'reactivate', ownerAccess), 409, 'SITE_LIMIT_REACHED', 'reactivating beyond 50 active sites');
        const [oneActive] = (await agencyPool.query("SELECT id FROM agency_sites WHERE agency_id = $1 AND name = 'Lieu 001'", [bulkSites])).rows;
        assert.equal((await siteAction(bulkSites, oneActive.id, 'deactivate', ownerAccess)).status, 200);
        assert.equal((await siteAction(bulkSites, oldSite.id, 'reactivate', ownerAccess)).status, 200, 'a place was freed');
        await agencyPool.query("INSERT INTO agency_sites (id, agency_id, name, name_key, city, address, created_at, deactivated_at) SELECT gen_random_uuid(), $1, 'Fermé ' || lpad(n::text, 3, '0'), 'ferme ' || lpad(n::text, 3, '0'), 'Douala', 'Rue du Marché, Akwa', now() - interval '1 day', now() FROM generate_series(1, 10) n", [bulkSites]);
        assert.equal((await agencyPool.query('SELECT count(*)::int AS total FROM agency_sites WHERE agency_id = $1', [bulkSites])).rows[0].total, 200);
        await problemOf(await createSite(bulkSites, ownerAccess, siteBody('Lieu 051')), 409, 'SITE_LIMIT_REACHED', 'at 50 active and 200 in all, the active limit is the one reported');
        const [secondActive] = (await agencyPool.query("SELECT id FROM agency_sites WHERE agency_id = $1 AND name = 'Lieu 002'", [bulkSites])).rows;
        assert.equal((await siteAction(bulkSites, secondActive.id, 'deactivate', ownerAccess)).status, 200);
        await problemOf(await createSite(bulkSites, ownerAccess, siteBody('Lieu 052')), 409, 'SITE_TOTAL_LIMIT_REACHED', 'a 201st site');
        assert.equal((await agencyPool.query('SELECT count(*)::int AS total FROM agency_sites WHERE agency_id = $1', [bulkSites])).rows[0].total, 200);

        // Refused characters, one definition for every text of the agency.
        activeOne = fixAgency;
        const hiddenCharacters = ['​', '‮', '‍', '﻿', '\u0000', '\u0085'];
        for (const char of hiddenCharacters) {
          assert.equal((await addZone(fixAgency, ownerAccess, { city: `Kum${char}ba` })).status, 400, `zone city ${JSON.stringify(char)}`);
          assert.equal((await createSite(fixAgency, ownerAccess, { name: `Agence${char}Nord`, city: 'Douala', address: 'Rue Joss, Akwa' })).status, 400, `site name ${JSON.stringify(char)}`);
          assert.equal((await patchAgency(`${fixAgency}/profile`, ownerAccess, { tradeName: `Express${char}Douala` }, '1')).status, 400, `trade name ${JSON.stringify(char)}`);
          assert.equal((await patchAgency(`${fixAgency}/profile`, ownerAccess, { description: `Livraison${char}rapide` }, '1')).status, 400, `description ${JSON.stringify(char)}`);
          assert.equal((await patchAgency(`${fixAgency}/identity`, ownerAccess, { legalName: `Express${char}SARL` }, '1')).status, 400, `legal name ${JSON.stringify(char)}`);
        }
        assert.equal((await patchAgency(`${fixAgency}/profile`, ownerAccess, { description: 'Ligne 1\nLigne\t2' }, '1')).status, 200, 'a description keeps its line breaks and tabs');
        assert.equal((await addZone(fixAgency, ownerAccess, { city: 'Kum\tba' })).status, 201, 'a tab inside a zone name is folded into a space');
        assert.equal((await zoneRows(fixAgency)).some(zone => zone.city === 'Kum ba'), true);

        // The membership is checked before the lock: a refused person is answered while the agency row is held; an allowed one waits.
        const holder = await agencyPool.connect();
        try {
          await holder.query('BEGIN');
          await holder.query('SELECT id FROM agencies WHERE id = $1 FOR UPDATE', [fixAgency]);
          const quickly = (response) => Promise.race([response, delay(4000).then(() => { throw new Error('answered only after the lock was released: the lock is taken before the membership check'); })]);
          const refusals = [
            ['an outsider correcting', 404, patchZone(fixAgency, akwaa.id, outsiderAccess, { city: 'Douala', district: 'Akwa Nord' })],
            ['a former member correcting', 404, patchZone(fixAgency, akwaa.id, formerAccess, { city: 'Douala', district: 'Akwa Nord' })],
            ['an outsider adding', 404, addZone(fixAgency, outsiderAccess, { city: 'Mbanga' })],
            ['an agent correcting', 403, patchZone(fixAgency, akwaa.id, agentAccess, { city: 'Douala', district: 'Akwa Nord' })],
            ['an outsider editing the profile', 404, patchAgency(`${fixAgency}/profile`, outsiderAccess, { description: 'Autre' }, '1')],
            ['an agent editing the identity', 403, patchAgency(`${fixAgency}/identity`, agentAccess, { legalName: 'Autre SARL' }, '1')],
            ['an outsider inviting', 404, act('POST', `${fixAgency}/invitations`, outsiderAccess, { email: 'nobody@example.com', role: 'agent' })],
            ['an agent inviting', 403, act('POST', `${fixAgency}/invitations`, agentAccess, { email: 'nobody@example.com', role: 'agent' })],
            ['an outsider submitting', 404, act('POST', `${fixAgency}/submit`, outsiderAccess)],
            ['an administrator submitting', 403, act('POST', `${fixAgency}/submit`, adminAccess)],
          ];
          for (const [who, status, response] of refusals) assert.equal((await quickly(response)).status, status, `${who} is answered without waiting for the lock`);
          const allowed = patchZone(fixAgency, akwaa.id, ownerAccess, { city: 'Douala', district: 'Akwa Sud' });
          const state = await Promise.race([allowed.then(() => 'answered'), delay(500).then(() => 'waiting')]);
          assert.equal(state, 'waiting', 'an allowed actor does wait for the lock');
          await holder.query('COMMIT');
          assert.equal((await allowed).status, 200, 'and goes through once the lock is released');
        } finally {
          await holder.query('ROLLBACK').catch(() => undefined);
          holder.release();
        }
        assert.equal((await zoneRow(akwaa.id)).district, 'Akwa Sud');
        activeOne = previousActive;
      }

      // B3.4, B3.5, B3.14, B3.6 (and the complements of B3.1 and B3.3): the delivery rate card, its versions and the price simulation.
      {
        const cardAgency = await configAgency();
        const previousActive = activeOne;
        activeOne = cardAgency;
        const zoneOf = async (agency, body) => (await (await addZone(agency, ownerAccess, body)).json());
        const akwaZone = await zoneOf(cardAgency, { city: 'Douala', district: 'Akwa' });
        const bonaZone = await zoneOf(cardAgency, { city: 'Douala', district: 'Bonabéri' });
        const deidoZone = await zoneOf(cardAgency, { city: 'Douala', district: 'Deïdo' });
        const bepandaZone = await zoneOf(cardAgency, { city: 'Douala', district: 'Bépanda' });
        assert.equal((await retireZone(cardAgency, bepandaZone.id, ownerAccess)).status, 200);
        const neighbour = await configAgency();
        const foreignZone = await zoneOf(neighbour, { city: 'Yaoundé', district: 'Bastos' });
        const akwaTiers = [{ upTo: '1 kg', price: 1000 }, { upTo: '5 kg', price: 1500 }, { upTo: '10 kg', price: 2500 }, { upTo: '30 kg', price: 5000 }];
        const bonaTiers = [{ upTo: '1 kg', price: 1500 }];
        const scaleOf = (akwaPrice = 1000, extra = {}) => ({ lines: [{ zoneId: akwaZone.id, tiers: [{ upTo: '1 kg', price: akwaPrice }, ...akwaTiers.slice(1)] }, { zoneId: bonaZone.id, tiers: bonaTiers }], ...extra });
        const createCard = (agency, access, body) => act('POST', `${agency}/rate-card`, access, body);
        const publishCard = (agency, access, body, ifMatch) => act('POST', `${agency}/rate-card/versions`, access, body, ifMatch === undefined ? {} : { 'if-match': ifMatch });
        const readCard = (agency, access) => act('GET', `${agency}/rate-card`, access);
        const readHistory = (agency, access, query = '') => act('GET', `${agency}/rate-card/versions${query}`, access);
        const readVersion = (agency, access, number) => act('GET', `${agency}/rate-card/versions/${number}`, access);
        const simulate = (agency, access, body) => act('POST', `${agency}/quotes/preview`, access, body);
        const parcel = (weight, dimensions) => (dimensions === undefined ? { weight } : { weight, dimensions });
        const cardRows = async (agency) => (await agencyPool.query('SELECT (SELECT count(*)::int FROM rate_cards WHERE agency_id = $1) AS cards, (SELECT count(*)::int FROM rate_card_versions WHERE agency_id = $1) AS versions, (SELECT count(*)::int FROM rate_card_lines WHERE agency_id = $1) AS lines', [agency])).rows[0];
        const pricingTrail = async (agency) => (await agencyPool.query("SELECT action, user_id, resource_id, details FROM identity_audit WHERE agency_id = $1 AND action ~ '^pricing\\.' ORDER BY occurred_at, id", [agency])).rows;
        const rejectsWith = async (work, code, message) => {
          try { await work(); } catch (error) { assert.equal(error.code, code, message); return; }
          assert.fail(`${message}: expected the database to refuse`);
        };

        // Nothing exists yet: the version routes answer not found, the simulation answers "no tariff".
        assert.deepEqual(await cardRows(cardAgency), { cards: 0, versions: 0, lines: 0 });
        for (const access of [ownerAccess, agentAccess]) {
          await problemOf(await readCard(cardAgency, access), 404, undefined, 'no rate card yet');
          await problemOf(await readHistory(cardAgency, access), 404, undefined, 'no history yet');
          await problemOf(await readVersion(cardAgency, access, 1), 404, undefined, 'no version yet');
        }
        const noCard = await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel('1 kg')] });
        assert.equal(noCard.status, 200, 'an agency without a rate card has no tariff, which is not an error');
        assert.deepEqual(await noCard.json(), { currency: 'XAF', indicative: true, notice: 'prix indicatif, non garanti sans devis', status: 'no_tariff', version: null, zoneId: akwaZone.id, parcels: [], total: null });
        await problemOf(await publishCard(cardAgency, ownerAccess, scaleOf(), '"1"'), 404, undefined, 'no version without a rate card');

        // Rights and isolation, before anything is written.
        await assertHidden('create the rate card', 'POST', agency => `${agency}/rate-card`, scaleOf());
        await assertHidden('publish a version', 'POST', agency => `${agency}/rate-card/versions`, scaleOf(), { 'if-match': '"1"' });
        await assertHidden('read the rate card', 'GET', agency => `${agency}/rate-card`);
        await assertHidden('read the history', 'GET', agency => `${agency}/rate-card/versions`);
        await assertHidden('read a version', 'GET', agency => `${agency}/rate-card/versions/1`);
        await assertHidden('simulate a price', 'POST', agency => `${agency}/quotes/preview`, { zoneId: akwaZone.id, parcels: [parcel('1 kg')] });
        await problemOf(await createCard(cardAgency, agentAccess, scaleOf()), 403, undefined, 'an agent cannot create the rate card');
        await problemOf(await publishCard(cardAgency, agentAccess, scaleOf(), '"1"'), 403, undefined, 'an agent cannot publish a version');
        assert.deepEqual(await cardRows(cardAgency), { cards: 0, versions: 0, lines: 0 }, 'refusals write nothing');

        // Invalid scales: 400, and nothing is written.
        const line = (tiers, zoneId = akwaZone.id) => ({ lines: [{ zoneId, tiers }] });
        const manyZones = Array.from({ length: 101 }, (_, index) => ({ zoneId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, tiers: [{ upTo: '1 kg', price: 1000 }] }));
        const manyTiers = Array.from({ length: 21 }, (_, index) => ({ upTo: `${index + 1} kg`, price: 1000 + index }));
        const invalidScales = {
          'a field that is not known': { ...scaleOf(), status: 'active' },
          'a currency other than XAF': scaleOf(1000, { currency: 'EUR' }),
          'a bound without unit': line([{ upTo: '5', price: 1000 }]),
          'a bound in pounds': line([{ upTo: '1 lb', price: 1000 }]),
          'a bound finer than the gram': line([{ upTo: '0,5 g', price: 1000 }]),
          'a bound over 1 000 kg': line([{ upTo: '1001 kg', price: 1000 }]),
          'bounds that decrease': line([{ upTo: '5 kg', price: 1500 }, { upTo: '1 kg', price: 1000 }]),
          'bounds that are equal once converted': line([{ upTo: '1 kg', price: 1000 }, { upTo: '1000 g', price: 1500 }]),
          'a price of zero': line([{ upTo: '1 kg', price: 0 }]),
          'a negative price': line([{ upTo: '1 kg', price: -500 }]),
          'a price with decimals': line([{ upTo: '1 kg', price: 1000.5 }]),
          'a price over 10 000 000': line([{ upTo: '1 kg', price: 10000001 }]),
          'a price with a currency in it': line([{ upTo: '1 kg', price: '10 EUR' }]),
          'a divisor under 1 000': scaleOf(1000, { volumetricDivisor: 999 }),
          'a divisor over 10 000': scaleOf(1000, { volumetricDivisor: 10001 }),
          'a zone on two lines': { lines: [{ zoneId: akwaZone.id, tiers: akwaTiers }, { zoneId: akwaZone.id, tiers: bonaTiers }] },
          'no line': { lines: [] },
          'a zone without tier': line([]),
          'more than 100 zones': { lines: manyZones },
          'more than 20 tiers': line(manyTiers),
          'a zone that is not an identifier': line(akwaTiers, 'akwa'),
          'a tier with a field that is not known': line([{ upTo: '1 kg', price: 1000, currency: 'XAF' }]),
          'a body that is not an object': [],
        };
        for (const [what, body] of Object.entries(invalidScales)) {
          assert.equal((await createCard(cardAgency, ownerAccess, body)).status, 400, `creation refuses ${what}`);
        }
        assert.equal((await act('POST', `${cardAgency}/rate-card`, ownerAccess, undefined)).status, 400, 'creation refuses an empty body');
        assert.equal((await createCard(cardAgency, null, scaleOf())).status, 401, 'creation needs a session');
        assert.deepEqual(await cardRows(cardAgency), { cards: 0, versions: 0, lines: 0 }, 'invalid scales write nothing');

        // Zones: another agency, unknown, retired.
        const foreign = await createCard(cardAgency, ownerAccess, line(akwaTiers, foreignZone.id));
        await problemOf(foreign, 404, undefined, 'a zone of another agency is not found');
        const unknownZone = await createCard(cardAgency, ownerAccess, line(akwaTiers, '00000000-0000-4000-8000-0000000000fe'));
        assert.deepEqual(withoutEcho(await unknownZone.json()), withoutEcho(await (await createCard(cardAgency, ownerAccess, line(akwaTiers, foreignZone.id))).json()), 'a zone of another agency answers like an unknown zone');
        await problemOf(await createCard(cardAgency, ownerAccess, line(akwaTiers, bepandaZone.id)), 409, 'ZONE_RETIRED', 'a retired zone cannot be priced');
        assert.deepEqual(await cardRows(cardAgency), { cards: 0, versions: 0, lines: 0 }, 'refused zones write nothing');
        assert.deepEqual(await pricingTrail(cardAgency), [], 'no trace for refusals');

        // Creation by an administrator: 201, version 1 in force, with the labels of the zones.
        const created = await createCard(cardAgency, adminAccess, scaleOf());
        assert.equal(created.status, 201, 'an administrator creates the rate card');
        assert.match(created.headers.get('cache-control'), /no-store/);
        assert.equal(created.headers.get('etag'), '"1"');
        const card = await created.json();
        assert.match(card.id, UUID);
        assert.deepEqual([card.version.number, card.version.createdBy, card.version.volumetricDivisor, card.version.currency], [1, adminUser, null, 'XAF']);
        assert.ok(Number.isFinite(Date.parse(card.version.createdAt)));
        const akwaLine = card.version.zones.find(item => item.zoneId === akwaZone.id);
        assert.deepEqual(akwaLine, { zoneId: akwaZone.id, city: 'Douala', district: 'Akwa', zoneStatus: 'active', tiers: [{ upToGrams: 1000, price: 1000 }, { upToGrams: 5000, price: 1500 }, { upToGrams: 10000, price: 2500 }, { upToGrams: 30000, price: 5000 }] });
        assert.equal(card.version.zones.length, 2);
        assert.deepEqual(await cardRows(cardAgency), { cards: 1, versions: 1, lines: 5 });
        assert.deepEqual((await pricingTrail(cardAgency)).map(entry => [entry.action, entry.user_id, entry.resource_id, entry.details]), [['pricing.rate_card_created', adminUser, card.id, { fields: ['version:1'] }]]);

        // A second creation is a conflict, and the rate card stays in version 1.
        await problemOf(await createCard(cardAgency, ownerAccess, scaleOf(1200)), 409, 'RATE_CARD_ALREADY_EXISTS', 'a second rate card is refused');
        assert.deepEqual(await cardRows(cardAgency), { cards: 1, versions: 1, lines: 5 });

        // Creation is atomic under concurrency: one rate card, one refusal.
        const raceAgency = await configAgency();
        const raceAkwa = await zoneOf(raceAgency, { city: 'Douala', district: 'Akwa' });
        const raceBody = { lines: [{ zoneId: raceAkwa.id, tiers: akwaTiers }] };
        const raceCreate = await Promise.all([createCard(raceAgency, ownerAccess, raceBody), createCard(raceAgency, adminAccess, raceBody), createCard(raceAgency, ownerAccess, raceBody)]);
        assert.deepEqual(raceCreate.map(response => response.status).sort(), [201, 409, 409], 'one of the simultaneous creations wins');
        assert.deepEqual(await cardRows(raceAgency), { cards: 1, versions: 1, lines: 4 });
        assert.equal((await pricingTrail(raceAgency)).length, 1, 'only the winner is audited');

        // Reading: every active member, ETag on the version in force.
        for (const access of [ownerAccess, adminAccess, agentAccess]) {
          const read = await readCard(cardAgency, access);
          assert.equal(read.status, 200);
          assert.match(read.headers.get('cache-control'), /no-store/);
          assert.equal(read.headers.get('etag'), '"1"');
          assert.deepEqual(await read.json(), card);
        }
        assert.equal((await readCard(cardAgency, null)).status, 401);

        // The database refuses what the application would never write.
        const storedCard = (await agencyPool.query('SELECT id FROM rate_cards WHERE agency_id = $1', [cardAgency])).rows[0].id;
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_lines (rate_card_id, version_number, zone_id, position, agency_id, max_weight_grams, price_xaf) VALUES ($1, 1, $2, 1, $3, 1000, 1000)', [storedCard, foreignZone.id, cardAgency]), '23503', 'a line cannot cite the zone of another agency');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_lines (rate_card_id, version_number, zone_id, position, agency_id, max_weight_grams, price_xaf) VALUES ($1, 1, $2, 1, $3, 1000, 1000)', [storedCard, foreignZone.id, neighbour]), '23503', 'a line cannot sit under a rate card of another agency');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_versions (rate_card_id, number, agency_id, created_by, created_at) VALUES ($1, 2, $2, $3, now())', [storedCard, neighbour, adminUser]), '23503', 'a version cannot sit under a rate card of another agency');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_versions (rate_card_id, number, agency_id, created_by, created_at) VALUES ($1, 1, $2, $3, now())', [storedCard, cardAgency, adminUser]), '23505', 'a version number is written once');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_cards (id, agency_id, current_version, created_at) VALUES ($1, $2, 1, now())', [randomUUID(), cardAgency]), '23505', 'an agency has one rate card');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_lines (rate_card_id, version_number, zone_id, position, agency_id, max_weight_grams, price_xaf) VALUES ($1, 1, $2, 9, $3, 1000, 0)', [storedCard, deidoZone.id, cardAgency]), '23514', 'a price of zero is refused by the database');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_lines (rate_card_id, version_number, zone_id, position, agency_id, max_weight_grams, price_xaf) VALUES ($1, 1, $2, 9, $3, 1000, 10000001)', [storedCard, deidoZone.id, cardAgency]), '23514', 'a price over 10 000 000 is refused by the database');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_lines (rate_card_id, version_number, zone_id, position, agency_id, max_weight_grams, price_xaf) VALUES ($1, 1, $2, 9, $3, 1000001, 1000)', [storedCard, deidoZone.id, cardAgency]), '23514', 'a bound over 1 000 kg is refused by the database');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_lines (rate_card_id, version_number, zone_id, position, agency_id, max_weight_grams, price_xaf) VALUES ($1, 1, $2, 9, $3, 1000, 1000)', [storedCard, akwaZone.id, cardAgency]), '23505', 'a bound is written once per zone and version');
        await rejectsWith(() => agencyPool.query('INSERT INTO rate_card_versions (rate_card_id, number, agency_id, created_by, created_at, volumetric_divisor) VALUES ($1, 2, $2, $3, now(), 999)', [storedCard, cardAgency, adminUser]), '23514', 'a divisor under 1 000 is refused by the database');
        assert.deepEqual(await cardRows(cardAgency), { cards: 1, versions: 1, lines: 5 }, 'the refused inserts left nothing');

        // Versions: If-Match is the version in force.
        const noIfMatch = await publishCard(cardAgency, ownerAccess, scaleOf(1200));
        assert.equal(noIfMatch.status, 428, 'publishing needs the version it is based on');
        for (const header of ['W/"1"', 'abc', '*', '"1", "2"', '0', '-1', '99999999999']) assert.equal((await publishCard(cardAgency, ownerAccess, scaleOf(1200), header)).status, 400, `malformed If-Match ${header}`);
        await problemOf(await publishCard(cardAgency, ownerAccess, scaleOf(1200), '"2"'), 409, 'STALE_RATE_CARD_VERSION', 'a base in the future is not the version in force');
        assert.equal((await publishCard(cardAgency, ownerAccess, scaleOf(1200), '"1"').then(response => response.status)), 201, 'the owner publishes version 2 on the version in force');
        const second = await (await readCard(cardAgency, agentAccess)).json();
        assert.equal(second.version.number, 2);
        assert.equal(second.version.createdBy, account.id);
        assert.equal(second.version.zones.find(item => item.zoneId === akwaZone.id).tiers[0].price, 1200, 'version 2 is in force at once');
        await problemOf(await publishCard(cardAgency, adminAccess, scaleOf(1300), '"1"'), 409, 'STALE_RATE_CARD_VERSION', 'a base that is no longer the version in force');
        const oldVersion = await readVersion(cardAgency, agentAccess, 1);
        assert.equal(oldVersion.status, 200);
        assert.deepEqual(await oldVersion.json(), card, 'version 1 is read exactly as it was written');
        assert.deepEqual(await cardRows(cardAgency), { cards: 1, versions: 2, lines: 10 });

        // An identical scale writes nothing and answers 200 with the version in force.
        const same = await publishCard(cardAgency, ownerAccess, scaleOf(1200), '"2"');
        assert.equal(same.status, 200, 'a scale identical to the one in force creates no version');
        assert.equal(same.headers.get('etag'), '"2"');
        assert.equal((await same.json()).version.number, 2);
        const reordered = { lines: [...scaleOf(1200).lines].reverse() };
        assert.equal((await publishCard(cardAgency, ownerAccess, reordered, '2')).status, 200, 'the order of the zones does not make a new scale');
        assert.deepEqual(await cardRows(cardAgency), { cards: 1, versions: 2, lines: 10 });

        // A new version is checked as the creation is; the version in force stays when it is refused.
        await problemOf(await publishCard(cardAgency, ownerAccess, line(akwaTiers, bepandaZone.id), '"2"'), 409, 'ZONE_RETIRED', 'a retired zone');
        await problemOf(await publishCard(cardAgency, ownerAccess, line(akwaTiers, foreignZone.id), '"2"'), 404, undefined, 'a zone of another agency');
        assert.equal((await publishCard(cardAgency, ownerAccess, line([{ upTo: '5', price: 1000 }]), '"2"')).status, 400, 'an invalid scale');
        assert.equal((await publishCard(cardAgency, null, scaleOf(1400), '"2"')).status, 401);
        assert.equal((await (await readCard(cardAgency, ownerAccess)).json()).version.number, 2, 'refusals keep the version in force');
        assert.deepEqual(await cardRows(cardAgency), { cards: 1, versions: 2, lines: 10 });

        // Concurrency: two versions based on the same one, only one wins.
        const raceVersions = await Promise.all([publishCard(cardAgency, ownerAccess, scaleOf(1300), '"2"'), publishCard(cardAgency, adminAccess, scaleOf(1400), '"2"')]);
        assert.deepEqual(raceVersions.map(response => response.status).sort(), [201, 409], 'one of the simultaneous versions wins');
        const loser = raceVersions.find(response => response.status === 409);
        assert.equal((await loser.json()).code, 'STALE_RATE_CARD_VERSION');
        assert.deepEqual(await cardRows(cardAgency), { cards: 1, versions: 3, lines: 15 }, 'a single version 3 exists');
        assert.deepEqual((await agencyPool.query('SELECT number FROM rate_card_versions WHERE agency_id = $1 ORDER BY number', [cardAgency])).rows.map(row => row.number), [1, 2, 3]);
        assert.equal((await agencyPool.query('SELECT current_version FROM rate_cards WHERE agency_id = $1', [cardAgency])).rows[0].current_version, 3);

        // Versions and retirement of a zone are serialized: a version never prices a zone already retired.
        const retiring = await zoneOf(cardAgency, { city: 'Douala', district: 'Logpom' });
        const raceZone = await Promise.all([
          publishCard(cardAgency, ownerAccess, { lines: [{ zoneId: akwaZone.id, tiers: akwaTiers }, { zoneId: retiring.id, tiers: bonaTiers }] }, '"3"'),
          retireZone(cardAgency, retiring.id, adminAccess),
        ]);
        assert.equal(raceZone[1].status, 200, 'the retirement always succeeds');
        if (raceZone[0].status === 201) {
          const written = (await agencyPool.query('SELECT v.created_at, z.retired_at FROM rate_card_versions v, service_zones z WHERE v.agency_id = $1 AND v.number = 4 AND z.id = $2', [cardAgency, retiring.id])).rows[0];
          assert.ok(written.retired_at >= written.created_at, 'a version written before the retirement, never after');
        } else {
          await problemOf(raceZone[0], 409, 'ZONE_RETIRED', 'a version after the retirement is refused');
        }
        const nextBase = raceZone[0].status === 201 ? 4 : 3;
        if (nextBase === 4) assert.equal((await publishCard(cardAgency, ownerAccess, scaleOf(1400), '"4"')).status, 201, 'a version without the retired zone');
        else assert.equal((await publishCard(cardAgency, ownerAccess, scaleOf(1400), '"3"')).status, 201, 'the next version');
        const latest = nextBase + 1;

        // The history: most recent first, a version for each effective publication, in pages.
        const history = await readHistory(cardAgency, agentAccess, '?limit=2');
        assert.equal(history.status, 200);
        assert.match(history.headers.get('cache-control'), /no-store/);
        const firstPage = await history.json();
        assert.deepEqual(firstPage.items.map(item => item.number), [latest, latest - 1]);
        assert.deepEqual([firstPage.hasMore, firstPage.nextCursor], [true, String(latest - 1)]);
        assert.deepEqual(Object.keys(firstPage.items[0]).sort(), ['createdAt', 'createdBy', 'number', 'volumetricDivisor', 'zoneCount']);
        const secondPage = await (await readHistory(cardAgency, agentAccess, `?limit=2&cursor=${firstPage.nextCursor}`)).json();
        assert.deepEqual(secondPage.items.map(item => item.number), [latest - 2, latest - 3]);
        const walked = [...firstPage.items, ...secondPage.items];
        let cursor = secondPage.nextCursor;
        while (cursor !== null) {
          const page = await (await readHistory(cardAgency, ownerAccess, `?limit=2&cursor=${cursor}`)).json();
          walked.push(...page.items);
          cursor = page.nextCursor;
        }
        assert.deepEqual(walked.map(item => item.number), Array.from({ length: latest }, (_, index) => latest - index), 'every version, once, most recent first');
        const everything = await (await readHistory(cardAgency, ownerAccess)).json();
        assert.deepEqual([everything.items.length, everything.hasMore, everything.nextCursor], [latest, false, null]);
        assert.deepEqual(everything.items.find(item => item.number === 1), { number: 1, createdAt: card.version.createdAt, createdBy: adminUser, volumetricDivisor: null, zoneCount: 2 });
        for (const bad of ['?limit=0', '?limit=51', '?limit=abc', '?cursor=abc', '?cursor=0', '?cursor=-1', '?cursor=1.5']) assert.equal((await readHistory(cardAgency, ownerAccess, bad)).status, 400, `history refuses ${bad}`);
        assert.equal((await readHistory(cardAgency, ownerAccess, '?limit=50')).status, 200);
        assert.equal((await readVersion(cardAgency, ownerAccess, latest + 1)).status, 404, 'an unknown version');
        for (const bad of ['0', 'abc', '-1', '1.5', '9999999999']) assert.equal((await readVersion(cardAgency, ownerAccess, bad)).status, 400, `version ${bad}`);
        assert.equal((await readVersion(cardAgency, null, 1)).status, 401);
        assert.deepEqual((await (await readVersion(cardAgency, agentAccess, 2)).json()).version.zones.find(item => item.zoneId === akwaZone.id).tiers[0].price, 1200, 'version 2 is still the one written');

        // Back to the first prices, so that the simulations below read round figures.
        assert.equal((await publishCard(cardAgency, ownerAccess, scaleOf(1000), `"${latest}"`)).status, 201, 'the prices of version 1 published again as a new version');

        // The retired zone keeps its tiers and is flagged; it is priced again when it comes back (B3.3).
        const flagged = await (await readCard(cardAgency, agentAccess)).json();
        assert.equal(flagged.version.zones.length, 2);
        assert.equal((await retireZone(cardAgency, akwaZone.id, ownerAccess)).status, 200);
        const whileRetired = await (await readCard(cardAgency, agentAccess)).json();
        const retiredLine = whileRetired.version.zones.find(item => item.zoneId === akwaZone.id);
        assert.deepEqual([retiredLine.zoneStatus, retiredLine.tiers.length, retiredLine.district], ['retired', 4, 'Akwa'], 'a retired zone keeps its tiers in the version in force');
        await problemOf(await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel('1 kg')] }), 409, 'ZONE_RETIRED', 'a retired zone cannot be priced');
        const back = await addZone(cardAgency, ownerAccess, { city: 'Douala', district: 'Akwa' });
        assert.equal((await back.json()).id, akwaZone.id, 'the zone comes back with the same identifier');
        const afterReturn = await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel('1 kg')] });
        assert.deepEqual([afterReturn.status, (await afterReturn.json()).total], [200, 1000], 'the tiers of the version in force apply again');

        // The simulation (every member): prices, bounds, volumetric weight, no tariff, out of scale.
        const priced = await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel('0,8 kg'), parcel('3 kg')] });
        assert.equal(priced.status, 200);
        assert.match(priced.headers.get('cache-control'), /no-store/);
        const expectedVersion = (await (await readCard(cardAgency, ownerAccess)).json()).version.number;
        assert.deepEqual(await priced.json(), { currency: 'XAF', indicative: true, notice: 'prix indicatif, non garanti sans devis', status: 'priced', version: expectedVersion, zoneId: akwaZone.id, parcels: [{ taxableGrams: 800, price: 1000 }, { taxableGrams: 3000, price: 1500 }], total: 2500 });
        for (const [weight, price] of [['0,999 kg', 1000], ['1 kg', 1000], ['1000 g', 1000], ['1,001 kg', 1500], ['30 kg', 5000]]) {
          assert.equal((await (await simulate(cardAgency, ownerAccess, { zoneId: akwaZone.id, parcels: [parcel(weight)] })).json()).total, price, `the bound is included: ${weight}`);
        }
        const outOfScale = await (await simulate(cardAgency, adminAccess, { zoneId: akwaZone.id, parcels: [parcel('2 kg'), parcel('31 kg')] })).json();
        assert.deepEqual([outOfScale.status, outOfScale.total, outOfScale.parcels.map(item => item.price)], ['out_of_scale', null, [1500, null]], 'a parcel over the last bound: signalled, no total');
        const noTariff = await (await simulate(cardAgency, agentAccess, { zoneId: deidoZone.id, parcels: [parcel('1 kg')] })).json();
        assert.deepEqual([noTariff.status, noTariff.total, noTariff.parcels, noTariff.version], ['no_tariff', null, [], expectedVersion], 'a zone without a line has no tariff (B3.1)');
        const rounded = await (await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel('0,0004 kg')] })).json();
        assert.deepEqual(rounded.parcels, [{ taxableGrams: 1, price: 1000 }], 'the taxable weight is rounded up to the gram');
        const unmeasured = await (await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel('0,5 kg', { length: 30, width: 20, height: 10, unit: 'cm' })] })).json();
        assert.deepEqual(unmeasured.parcels, [{ taxableGrams: 500, price: 1000 }], 'without divisor, only the real weight counts');
        const volumetricVersion = await publishCard(cardAgency, ownerAccess, scaleOf(1000, { volumetricDivisor: 5000 }), `"${expectedVersion}"`);
        assert.equal(volumetricVersion.status, 201, 'a version with a volumetric divisor');
        for (const [weight, dimensions, taxable, price] of [['0,5 kg', { length: 30, width: 20, height: 10, unit: 'cm' }, 1200, 1500], ['2 kg', { length: 10, width: 10, height: 10, unit: 'cm' }, 2000, 1500]]) {
          const result = await (await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel(weight, dimensions)] })).json();
          assert.deepEqual([result.version, result.parcels[0].taxableGrams, result.total], [expectedVersion + 1, taxable, price], `volumetric weight: ${weight}`);
        }
        assert.equal((await (await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel('1 kg')] })).json()).version, expectedVersion + 1, 'the simulation always uses the version in force');
        const twenty = await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: Array.from({ length: 20 }, () => parcel('1 kg')) });
        assert.equal((await twenty.json()).total, 20000, 'the total is the exact sum');

        // Invalid simulations.
        const invalidSimulations = {
          'a weight without unit': { zoneId: akwaZone.id, parcels: [parcel('2')] },
          'a weight in pounds': { zoneId: akwaZone.id, parcels: [parcel('2 lb')] },
          'a weight of zero': { zoneId: akwaZone.id, parcels: [parcel('0 kg')] },
          'a negative weight': { zoneId: akwaZone.id, parcels: [parcel('-1 kg')] },
          'a weight over 1 000 kg': { zoneId: akwaZone.id, parcels: [parcel('1001 kg')] },
          'two dimensions out of three': { zoneId: akwaZone.id, parcels: [parcel('1 kg', { length: 30, width: 20, unit: 'cm' })] },
          'dimensions without unit': { zoneId: akwaZone.id, parcels: [parcel('1 kg', { length: 30, width: 20, height: 10 })] },
          'dimensions in inches': { zoneId: akwaZone.id, parcels: [parcel('1 kg', { length: 30, width: 20, height: 10, unit: 'in' })] },
          'a dimension of zero': { zoneId: akwaZone.id, parcels: [parcel('1 kg', { length: 30, width: 20, height: 0, unit: 'cm' })] },
          'a dimension over 500 cm': { zoneId: akwaZone.id, parcels: [parcel('1 kg', { length: 501, width: 20, height: 10, unit: 'cm' })] },
          'no parcel': { zoneId: akwaZone.id, parcels: [] },
          'more than 20 parcels': { zoneId: akwaZone.id, parcels: Array.from({ length: 21 }, () => parcel('1 kg')) },
          'a zone that is not an identifier': { zoneId: 'akwa', parcels: [parcel('1 kg')] },
          'a field that is not known': { zoneId: akwaZone.id, parcels: [parcel('1 kg')], agencyId: cardAgency },
          'a parcel field that is not known': { zoneId: akwaZone.id, parcels: [{ weight: '1 kg', price: 1 }] },
          'no zone': { parcels: [parcel('1 kg')] },
        };
        for (const [what, body] of Object.entries(invalidSimulations)) assert.equal((await simulate(cardAgency, ownerAccess, body)).status, 400, `simulation refuses ${what}`);
        assert.equal((await simulate(cardAgency, null, { zoneId: akwaZone.id, parcels: [parcel('1 kg')] })).status, 401);
        await problemOf(await simulate(cardAgency, ownerAccess, { zoneId: foreignZone.id, parcels: [parcel('1 kg')] }), 404, undefined, 'a zone of another agency');
        await problemOf(await simulate(cardAgency, ownerAccess, { zoneId: '00000000-0000-4000-8000-0000000000fe', parcels: [parcel('1 kg')] }), 404, undefined, 'an unknown zone');
        await problemOf(await simulate(cardAgency, ownerAccess, { zoneId: bepandaZone.id, parcels: [parcel('1 kg')] }), 409, 'ZONE_RETIRED', 'a retired zone');
        const noCardInvalid = await simulate(neighbour, ownerAccess, { zoneId: foreignZone.id, parcels: [parcel('2')] });
        assert.equal(noCardInvalid.status, 400, 'an invalid weight is refused even where there is no rate card');

        // A simulation writes nothing.
        const before = [await cardRows(cardAgency), await pricingTrail(cardAgency)];
        await simulate(cardAgency, agentAccess, { zoneId: akwaZone.id, parcels: [parcel('1 kg')] });
        await simulate(cardAgency, agentAccess, { zoneId: deidoZone.id, parcels: [parcel('1 kg')] });
        assert.deepEqual([await cardRows(cardAgency), await pricingTrail(cardAgency)], before, 'no version, no trace');

        // Audit: one trace per effective creation or version, with the rate card and the version number, nothing else.
        const trail = await pricingTrail(cardAgency);
        const effectiveVersions = (await agencyPool.query('SELECT count(*)::int AS total FROM rate_card_versions WHERE agency_id = $1', [cardAgency])).rows[0].total;
        assert.equal(trail.length, effectiveVersions, 'one trace for each version written, none for refusals, no-ops and simulations');
        assert.deepEqual(trail[0], { action: 'pricing.rate_card_created', user_id: adminUser, resource_id: card.id, details: { fields: ['version:1'] } });
        assert.ok(trail.slice(1).every((entry, index) => entry.action === 'pricing.rate_card_versioned' && entry.resource_id === card.id && entry.details.fields[0] === `version:${index + 2}`), 'every later trace names its version');
        const everyPricingTrace = JSON.stringify(trail);
        for (const secret of ['Douala', 'Akwa', 'Bonab', akwaZone.id, bonaZone.id]) assert.ok(!everyPricingTrace.includes(secret), `the audit never holds "${secret}"`);
        activeOne = previousActive;
      }

      // Audit: one row per effective action, names and types only.
      const trail = await configAudit(capsAgency);
      assert.deepEqual(trail.filter(entry => entry.action === 'agency.capability_enabled' || entry.action === 'agency.capability_suspended').slice(0, 3).map(entry => [entry.action, entry.user_id, entry.details]), [
        ['agency.capability_enabled', adminUser, { fields: ['delivery'] }],
        ['agency.capability_enabled', account.id, { fields: ['storage'] }],
        ['agency.capability_suspended', account.id, { fields: ['storage'] }],
      ]);
      const everyTrace = JSON.stringify([...await configAudit(zonesAgency), ...await configAudit(sitesAgency), ...trail]);
      for (const secret of ['Inventaire annuel', 'Douala', 'Akwa', 'Rue Joss', '+237677123456', 'Bonabéri', 'Agence']) assert.ok(!everyTrace.includes(secret), `the audit never holds "${secret}"`);
      const zoneTrail = (await configAudit(zonesAgency)).map(entry => entry.action);
      assert.equal(zoneTrail.filter(action => action === 'agency.zone_added').length, 6, 'every accepted zone is audited once');
      assert.equal(zoneTrail.filter(action => action === 'agency.zone_retired').length, 1);
      assert.equal(zoneTrail.filter(action => action === 'agency.zone_reactivated').length, 1);
      const zoneEntries = await configAudit(zonesAgency);
      assert.deepEqual(zoneEntries.filter(entry => entry.action === 'agency.zone_retired').map(entry => entry.resource_id), [akwa.id], 'the retirement names the zone it retired');
      const zoneIds = (await zoneRows(zonesAgency)).map(zone => zone.id);
      assert.ok(zoneEntries.every(entry => zoneIds.includes(entry.resource_id)), 'every zone action names a zone of the agency');
      const siteEntries = await configAudit(sitesAgency);
      assert.deepEqual(siteEntries.filter(entry => entry.action === 'agency.site_deactivated').map(entry => entry.resource_id).sort(), [depot.id, removedTwin].sort(), 'each deactivation names its site');
      const siteIds = (await agencyPool.query('SELECT id FROM agency_sites WHERE agency_id = $1', [sitesAgency])).rows.map(site => site.id);
      assert.ok(siteEntries.every(entry => siteIds.includes(entry.resource_id)), 'every site action names a site of the agency');
      assert.ok(trail.filter(entry => entry.action.startsWith('agency.capability_')).every(entry => entry.resource_id === null), 'capability actions have no resource');
      const siteTrail = siteEntries.map(entry => entry.action);
      assert.deepEqual(['agency.site_created', 'agency.site_updated', 'agency.site_deactivated', 'agency.site_reactivated'].map(action => siteTrail.filter(item => item === action).length), [5, 2, 2, 1], 'creations, updates, deactivations and reactivations of the sites agency');
      }
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
      // The actions on the configuration agencies (zones, sites, capabilities, submissions, edits made to prepare them) are counted against them above.
      const actions = await auditPool.query("SELECT action, count(*)::int AS total FROM identity_audit WHERE action !~ '^agency\\.(zone|site|capability)_|^agency\\.submitted$' AND (agency_id IS NULL OR agency_id NOT IN (SELECT id FROM agencies WHERE trade_name = 'Configuration Express')) GROUP BY action ORDER BY action");
      const { 'agency.identity_updated': identityEdits, 'agency.profile_updated': profileEdits, ...otherActions } = Object.fromEntries(actions.rows.map(row => [row.action, row.total]));
      assert.equal(identityEdits + profileEdits, 13, 'one audit row per effective identity or profile edit');
      assert.ok(identityEdits === 5 || identityEdits === 6, 'the identity and profile edits racing on one version: either one may have won');
      assert.deepEqual(otherActions, {
        'agency.created': 8, 'invitation.accepted': 2, 'invitation.created': 4, 'membership.removed': 1, 'membership.role_changed': 1,
        'session.login': 2, 'session.logout': 1, 'session.refresh': 1, 'user.registered': 1,
      }, 'every successful change is audited exactly once');
      const acceptedAudit = await auditPool.query("SELECT user_id, agency_id, subject_user_id FROM identity_audit WHERE action = 'invitation.accepted' AND agency_id = $1", [httpAgency]);
      assert.deepEqual(acceptedAudit.rows[0], { user_id: '00000000-0000-4000-8000-000000000024', agency_id: httpAgency, subject_user_id: '00000000-0000-4000-8000-000000000024' });
      const roleAudit = await auditPool.query("SELECT user_id, agency_id, subject_user_id FROM identity_audit WHERE action = 'membership.role_changed'");
      assert.deepEqual(roleAudit.rows[0], { user_id: account.id, agency_id: httpAgency, subject_user_id: '00000000-0000-4000-8000-000000000012' });
      const createdAudit = await auditPool.query("SELECT agency_id, subject_user_id FROM identity_audit WHERE action = 'invitation.created' AND agency_id = $1 LIMIT 1", [httpAgency]);
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
      '/api/v1/agencies', '/api/v1/agencies/{agencyId}', '/api/v1/agencies/{agencyId}/capabilities/{type}/activate', '/api/v1/agencies/{agencyId}/capabilities/{type}/suspend', '/api/v1/agencies/{agencyId}/identity', '/api/v1/agencies/{agencyId}/invitations', '/api/v1/agencies/{agencyId}/members', '/api/v1/agencies/{agencyId}/members/{memberId}', '/api/v1/agencies/{agencyId}/onboarding', '/api/v1/agencies/{agencyId}/profile', '/api/v1/agencies/{agencyId}/quotes/preview', '/api/v1/agencies/{agencyId}/rate-card', '/api/v1/agencies/{agencyId}/rate-card/versions', '/api/v1/agencies/{agencyId}/rate-card/versions/{number}', '/api/v1/agencies/{agencyId}/sites', '/api/v1/agencies/{agencyId}/sites/{siteId}', '/api/v1/agencies/{agencyId}/sites/{siteId}/deactivate', '/api/v1/agencies/{agencyId}/sites/{siteId}/reactivate', '/api/v1/agencies/{agencyId}/submit', '/api/v1/agencies/{agencyId}/zones', '/api/v1/agencies/{agencyId}/zones/{zoneId}',
      '/api/v1/agency-invitations/accept',
      '/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/refresh', '/api/v1/auth/register',
      '/api/v1/health/live', '/api/v1/health/ready', '/api/v1/me', '/api/v1/me/agencies',
    ], 'public route set is the documented one');
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
