'use strict';

/* Starts Morsel against its own database for tests, so they never touch your real data.
   The database is TEST_MONGODB_URI, or MONGODB_URI with the database name replaced by morsel_test.
   Anything whose name doesn't end in _test is refused. The test database is emptied and seeded
   on every run, then a server is started on TEST_PORT (default 3100) with DEMO_MODE=true. */

const path = require('path');
const { spawn, spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const ROOT = path.join(__dirname, '..');

function testUri() {
  if (process.env.TEST_MONGODB_URI) return process.env.TEST_MONGODB_URI.trim();
  const base = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/morsel').trim();
  const u = new URL(base);
  u.pathname = '/morsel_test';
  return u.toString();
}

function dbName(uri) {
  return new URL(uri).pathname.replace(/^\//, '');
}

/* The one guard everything else relies on. */
function assertTestDb(uri) {
  const name = dbName(uri);
  if (!/_test$/.test(name)) throw new Error(`Refusing to run tests against “${name}”: the database name must end in _test.`);
  return name;
}

function env(uri, port) {
  return { ...process.env, MONGODB_URI: uri, PORT: String(port), DEMO_MODE: 'true', NODE_ENV: 'test', UNSPLASH_ACCESS_KEY: '', SIGNUP_LIMIT: '500' };
}

async function resetDb(uri) {
  assertTestDb(uri);
  const mongoose = require('mongoose');
  const conn = await mongoose.createConnection(uri).asPromise();
  await conn.dropDatabase();
  await conn.close();
  const seed = spawnSync(process.execPath, ['seed/seed.js'], { cwd: ROOT, env: env(uri, 0), encoding: 'utf8' });
  if (seed.status !== 0) throw new Error('Seeding the test database failed:\n' + seed.stdout + seed.stderr);
}

async function waitForServer(base, child, log) {
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error('The test server stopped:\n' + log.join(''));
    try { const r = await fetch(base + '/api/restaurants'); if (r.ok) return; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('The test server did not start within 20 s:\n' + log.join(''));
}

/* Resets the test database and starts a server. Returns { base, uri, log, stop }. */
async function startTestServer({ port = Number(process.env.TEST_PORT || 3100) } = {}) {
  const uri = testUri();
  assertTestDb(uri);
  /* Something already answering on the port would be tested instead of this code. */
  try { await fetch(`http://localhost:${port}/`); throw new Error(`Port ${port} is already in use. Stop whatever runs there (an earlier test server?) or set TEST_PORT.`); }
  catch (err) { if (err.message.startsWith('Port ')) throw err; }
  await resetDb(uri);
  const log = [];
  const child = spawn(process.execPath, ['server/app.js'], { cwd: ROOT, env: env(uri, port), stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => log.push(String(d)));
  child.stderr.on('data', d => log.push(String(d)));
  const base = `http://localhost:${port}`;
  await waitForServer(base, child, log);
  const stop = () => new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  });
  return { base, uri, log, stop };
}

module.exports = { startTestServer, testUri, assertTestDb, resetDb };
