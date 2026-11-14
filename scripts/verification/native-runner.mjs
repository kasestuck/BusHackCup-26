/**
 * Run both verification suites against an isolated native PostgreSQL cluster.
 * Windows x64 only; binaries come from the pinned optional dependency.
 * Usage: node scripts/verification/native-runner.mjs
 *
 * The server listens only on a random loopback port and uses local trust auth.
 * Processes remain hidden on Windows. The server is stopped in finally, while
 * its data and log files remain in the ignored .cache directory for inspection.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, openSync, closeSync } from 'node:fs';
import { mkdir, mkdtemp, access } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('This runner requires Windows x64. Use the verification scripts with an external disposable PostgreSQL database on other platforms.');
}

const { initdb, pg_ctl, postgres } = await import('@embedded-postgres/windows-x64');
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const cacheRoot = path.join(directory, '.cache');
await mkdir(cacheRoot, { recursive: true });
const clusterRoot = await mkdtemp(path.join(cacheRoot, 'postgres-'));
const dataDirectory = path.join(clusterRoot, 'data');
const logFile = path.join(clusterRoot, 'postgres.log');
const commandLog = path.join(clusterRoot, 'commands.log');
let startAttempted = false;
let failure;

async function availableLoopbackPort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

function execute(label, executable, args, { env = process.env, output = false, timeout = 45000 } = {}) {
  appendFileSync(commandLog, `${label}\n`);
  // The background server may inherit pg_ctl handles. Files avoid waiting for
  // an inherited pipe to close after pg_ctl has already exited successfully.
  const logDescriptor = output ? undefined : openSync(commandLog, 'a');
  let result;
  try {
    result = spawnSync(executable, args, {
      cwd: root,
      env,
      windowsHide: true,
      timeout,
      encoding: 'utf8',
      stdio: output ? ['ignore', 'pipe', 'pipe'] : ['ignore', logDescriptor, logDescriptor],
      maxBuffer: 4 * 1024 * 1024,
    });
  } finally {
    if (logDescriptor !== undefined) closeSync(logDescriptor);
  }
  appendFileSync(commandLog, `${label}\n${result.stdout ?? ''}${result.stderr ?? ''}\n`);
  if (output) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.error || result.status !== 0) {
    // Do not print command arguments or environment variables containing URLs.
    const reason = result.error?.code ?? `exit ${result.status}`;
    throw new Error(`${label} failed (${reason}). Command log: ${commandLog}; PostgreSQL log: ${logFile}`);
  }
}

try {
  // The Windows package currently has no symlinks to hydrate.
  await Promise.all([initdb, pg_ctl, postgres].map(binary => access(binary)));
  execute('initdb', initdb, [
    '-D', dataDirectory,
    '--username=postgres',
    '--encoding=UTF8',
    '--locale=C',
    '--auth-local=trust',
    '--auth-host=trust',
    '--no-instructions',
  ]);
  console.log('PASS: initialized an isolated native PostgreSQL cluster.');

  const port = await availableLoopbackPort();
  startAttempted = true;
  execute('PostgreSQL startup', pg_ctl, [
    '-D', dataDirectory,
    '-l', logFile,
    '-o', `-h 127.0.0.1 -p ${port}`,
    '-w', '-t', '30', 'start',
  ], { timeout: 35000 });
  console.log('PASS: PostgreSQL is listening on loopback with hidden Windows processes.');

  const env = {
    ...process.env,
    TEST_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    TEST_DATABASE_DISPOSABLE: '1',
  };
  execute('Schema, security and contract verification', process.execPath, [
    '--use-system-ca',
    path.join(directory, 'verify.mjs'),
  ], { env, output: true, timeout: 60000 });
  execute('Concurrent activity and redemption verification', process.execPath, [
    '--use-system-ca',
    path.join(directory, 'concurrency.mjs'),
  ], { env, output: true, timeout: 60000 });
} catch (error) {
  failure = error;
} finally {
  if (startAttempted) {
    try {
      execute('PostgreSQL shutdown', pg_ctl, [
        '-D', dataDirectory,
        '-m', 'fast', '-w', '-t', '30', 'stop',
      ], { timeout: 35000 });
      console.log('PASS: isolated PostgreSQL server stopped.');
    } catch (shutdownError) {
      failure ??= shutdownError;
      console.error(`PostgreSQL shutdown failed. Inspect the retained cluster: ${clusterRoot}`);
    }
  }
  console.log(`Retained verification data and logs: ${clusterRoot}`);
}

if (failure) {
  console.error(`FAIL: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log('PASS: native PostgreSQL verification completed.');
}
