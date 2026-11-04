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

      for (const [role, access] of [['owner', tokens.accessToken], ['admin', adminAccess], ['agent', invitedTokens.accessToken]]) {
        const read = await getAgency(access, editable);
        assert.equal(read.status, 200, `${role} reads the agency`);
        assert.equal(read.headers.get('etag'), '"1"', `${role} gets the version as an ETag`);
        assert.match(read.headers.get('cache-control'), /no-store/);
        assert.deepEqual(await read.json(), { id: editable, status: 'draft', tradeName: 'Edition Express', description: null, version: 1, identity: { legalName: null, headquartersCity: null, headquartersAddress: null, primaryPhone: null, contactEmail: null, rccm: null, niu: null } });
      }
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
      assert.equal((await getAgency(invitedTokens.accessToken, editable)).headers.get('etag'), '"3"');
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
        { headquartersCity: 'D' }, { headquartersAddress: 'Rue' }, { contactEmail: 'contact@' }, { rccm: 'RC' }, { niu: 'M0123456789A' }, { niu: 5 },
      ];
      for (const body of refusedIdentity) assert.equal((await patchAgency(`${editable}/identity`, tokens.accessToken, body, '3')).status, 400, `identity refused ${JSON.stringify(body).slice(0, 60)}`);
      assert.equal((await patchAgency(`${editable}/identity`, tokens.accessToken, ['legalName'], '3')).status, 400, 'a list is not an identity');
      const refusedProfile = [{ legalName: 'Autre SARL' }, { status: 'approved' }, { tradeName: '' }, { tradeName: 'A' }, { tradeName: 'x'.repeat(121) }, { tradeName: null }, { description: 'x'.repeat(1001) }, { description: 'a\u0000b' }, { description: 5 }, { primaryPhone: '677123456' }];
      for (const body of refusedProfile) assert.equal((await patchAgency(`${editable}/profile`, tokens.accessToken, body, '3')).status, 400, `profile refused ${JSON.stringify(body).slice(0, 60)}`);
      assert.deepEqual([(await row()).version, (await row()).legal_name], [3, 'Express Douala SARL'], 'invalid bodies wrote nothing');

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
        'agency.created': 8, 'agency.identity_updated': 6, 'agency.profile_updated': 7, 'invitation.accepted': 2, 'invitation.created': 4, 'membership.removed': 1, 'membership.role_changed': 1,
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
      '/api/v1/agencies', '/api/v1/agencies/{agencyId}', '/api/v1/agencies/{agencyId}/identity', '/api/v1/agencies/{agencyId}/invitations', '/api/v1/agencies/{agencyId}/members/{memberId}', '/api/v1/agencies/{agencyId}/onboarding', '/api/v1/agencies/{agencyId}/profile', '/api/v1/agency-invitations/accept',
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
