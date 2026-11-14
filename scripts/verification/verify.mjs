import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import ts from 'typescript';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const onNotice = (notice) => {
  if (notice.message.startsWith('PASS:')) console.log(notice.message);
};
let database;
const native = Boolean(process.env.TEST_DATABASE_URL);
if (native) {
  assert.equal(process.env.TEST_DATABASE_DISPOSABLE, '1', 'Only use a fresh disposable database.');
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  client.on('notice', onNotice);
  database = { exec: (sql) => client.query(sql), close: () => client.end() };
} else {
  database = new PGlite();
}

try {
  // This isolated database models Supabase Auth primitives, not its HTTP services.
  // CREATE ROLE intentionally fails if pointed at an existing Supabase installation.
  await database.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  `);
  const migrations = (await readdir(path.join(root, 'supabase/migrations')))
    .filter((name) => name.endsWith('.sql')).sort();
  assert.ok(migrations.length >= 3, 'Activity verification requires all project migrations.');
  for (const name of migrations) {
    await database.exec(await readFile(path.join(root, 'supabase/migrations', name), 'utf8'));
    console.log(`PASS: applied ${name}`);
  }
  await database.exec(await readFile(path.join(directory, 'assertions.sql'), 'utf8'));
  console.log('PASS: SQL assertions completed and fixtures rolled back');
} finally {
  await database.close();
}

const proposal = await readFile(path.join(root, 'docs/contract-proposal.md'), 'utf8');
const blocks = [...proposal.matchAll(/```(?:ts|typescript)\r?\n([\s\S]*?)```/g)]
  .map((match) => match[1]);
assert.ok(blocks.length > 0, 'The contract proposal must contain TypeScript blocks.');
const generatedDirectory = path.join(directory, '.generated');
await mkdir(generatedDirectory, { recursive: true });
const sourcePath = path.join(generatedDirectory, 'contract.ts');
const source = blocks.join('\n\n');
await writeFile(sourcePath, source);
const options = {
  strict: true, noEmit: true, skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
};
const program = ts.createProgram([sourcePath], options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => directory,
    getCanonicalFileName: (name) => name,
    getNewLine: () => '\n',
  }));
  throw new Error('Contract type checking failed.');
}
console.log(`PASS: type checked ${blocks.length} TypeScript blocks from the proposal`);
const output = ts.transpileModule(source, { compilerOptions: options }).outputText;
const modulePath = path.join(generatedDirectory, 'contract.mjs');
await writeFile(modulePath, output);
const contract = await import(pathToFileURL(modulePath).href);
const { verifyContract } = await import('./verify-contract.mjs');
verifyContract(contract);
if (!native) console.log('LIMITATION: PGlite uses one connection; run native-runner.mjs for concurrency verification.');
console.log('LIMITATION: Supabase Auth, REST, Storage and Next.js routes were not exercised.');
