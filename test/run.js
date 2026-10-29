'use strict';

/* npm test            API tests (test/api)
   npm run test:e2e    browser tests with Playwright and Microsoft Edge (test/e2e)
   npm run test:all    both
   npm run test:sweep  slow: every page and button for every role (test/slow); not finished yet
   node test/run.js api test/api/auth.test.js   one file
   node test/run.js serve                       a seeded test server to try things by hand
   Every run empties and seeds the morsel_test database and starts its own server on port 3100,
   so your real database is never touched. The run fails if the server logs an error. */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { startTestServer } = require('./harness');

const ROOT = path.join(__dirname, '..');
const [kind = 'api', ...files] = process.argv.slice(2);
const dirs = kind === 'all' ? ['api', 'e2e'] : [kind];

function testFiles() {
  if (files.length) return files;
  return dirs.flatMap(d => fs.readdirSync(path.join(__dirname, d)).filter(f => f.endsWith('.test.js')).sort().map(f => path.join('test', d, f)));
}

(async () => {
  const server = await startTestServer();
  console.log(`Test server on ${server.base}, database ${new URL(server.uri).pathname.slice(1)}`);
  /* node test/run.js serve: keep a freshly seeded test server running until Ctrl+C. */
  if (kind === 'serve') {
    server.log.length = 0;
    const show = () => { process.stdout.write(server.log.splice(0).join('')); };
    setInterval(show, 500);
    process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
    return;
  }
  let status = 1;
  try {
    const run = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=spec', ...testFiles()], {
      cwd: ROOT, stdio: 'inherit', env: { ...process.env, MORSEL_TEST_BASE: server.base, MORSEL_TEST_DB: server.uri }
    });
    status = run.status;
  } finally {
    await server.stop();
  }
  /* Anything the server printed to stderr, or an error stack in its output, fails the run. */
  const problems = server.log.join('').split('\n').filter(l => /error|exception|unhandled|warning: /i.test(l) && !/^Demo mode is on/.test(l));
  if (problems.length) {
    console.error('\nThe server logged problems during the tests:\n' + problems.slice(0, 40).join('\n'));
    status = status || 1;
  }
  process.exit(status);
})().catch(err => { console.error(err); process.exit(1); });
