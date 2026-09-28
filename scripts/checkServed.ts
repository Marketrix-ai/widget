/**
 * `bun run check:served` — checks what the runtime image actually sends a customer host over real HTTP.
 * Boots the `runtime` Docker image and fails without docker; `TARGET_URL` points the checks at a deployed
 * host and `EXPECTED_TAG` also asserts the served bundle matches a source build of that tag. Expected headers
 * are read from `nginx.conf` so they cannot drift.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import packageJson from '../package.json';
import { precompress } from './precompress.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const nginxConf = readFileSync(join(ROOT, 'nginx.conf'), 'utf8');

function extractBlock(startMarker: string): string {
  const start = nginxConf.indexOf(startMarker);
  if (start === -1) throw new Error(`nginx.conf dropped '${startMarker}'`);
  let depth = 0;
  let end = start;
  for (; end < nginxConf.length; end++) {
    if (nginxConf[end] === '{') depth += 1;
    else if (nginxConf[end] === '}' && --depth === 0) {
      end += 1;
      break;
    }
  }
  return nginxConf.slice(start, end);
}

function headerValue(block: string, header: string): string {
  const match = new RegExp(`add_header ${header} ([^;]+) always;`).exec(block);
  if (!match?.[1]) throw new Error(`nginx.conf's '${header}' add_header (with 'always') is missing from its block`);
  return match[1].trim().replace(/^"(.*)"$/, '$1');
}

const headersOf = (block: string) => ({
  cacheControl: headerValue(block, 'Cache-Control'),
  cors: headerValue(block, 'Access-Control-Allow-Origin'),
});
const expectedHeaders = {
  widget: headersOf(extractBlock('location = /widget.mjs {')),
  root: headersOf(extractBlock('location / {')),
};

const targetUrl = process.env['TARGET_URL'];
const IMAGE = 'widget-check-served:local';

async function bootLocal(): Promise<{ base: string; container: string }> {
  if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0)
    throw new Error('check:served needs a running docker daemon, or TARGET_URL pointing at a deployed host');
  if (!existsSync(join(ROOT, 'dist/widget.mjs')))
    throw new Error('dist/widget.mjs missing — run `bun run build` first');
  precompress(join(ROOT, 'dist/widget.mjs'));

  const bunVersion = packageJson.packageManager.replace(/^bun@/, '');
  execFileSync(
    'docker',
    ['build', '--target', 'runtime', '--build-arg', `BUN_VERSION=${bunVersion}`, '-t', IMAGE, '.'],
    {
      cwd: ROOT,
      stdio: 'inherit',
    },
  );
  const container = execFileSync('docker', ['run', '-d', '-P', IMAGE]).toString().trim();
  const port = execFileSync('docker', ['port', container, '9001/tcp'])
    .toString()
    .trim()
    .split('\n')[0]
    ?.split(':')
    .pop();
  const base = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((await fetch(`${base}/health`).catch(() => null))?.ok) return { base, container };
    await Bun.sleep(200);
  }
  spawnSync('docker', ['rm', '-f', container]);
  throw new Error('runtime container never answered /health');
}

let container: string | null = null;

try {
  let base = targetUrl;
  if (!base) ({ base, container } = await bootLocal());
  let rows = 0;
  const mismatches: string[] = [];

  const check = async (label: string, run: () => Promise<void>) => {
    rows += 1;
    try {
      await run();
    } catch (error) {
      mismatches.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const noPoweredBy = (r: Response) =>
    assert.equal(r.headers.get('x-powered-by'), null, 'X-Powered-By leaks the stack');

  const assertBytesEqual = (actual: Uint8Array, expected: Uint8Array, label: string) => {
    assert.equal(actual.length, expected.length, `${label}: ${actual.length} bytes, expected ${expected.length}`);
    assert.deepEqual(actual, expected, label);
  };
  const fileBytes = (relative: string) => Bun.file(join(ROOT, relative)).bytes();

  await check('/widget.mjs identity (br;q=0, gzip;q=0)', async () => {
    const r = await fetch(`${base}/widget.mjs`, { headers: { 'Accept-Encoding': 'br;q=0, gzip;q=0' } });
    assert.equal(r.status, 200);
    noPoweredBy(r);
    assert.equal(r.headers.get('content-type'), 'application/javascript');
    assert.equal(r.headers.get('cache-control'), expectedHeaders.widget.cacheControl);
    assert.equal(r.headers.get('access-control-allow-origin'), expectedHeaders.widget.cors);
    assert.equal(r.headers.get('content-encoding'), null, 'an explicit refusal must not still get a compressed body');
    const plain = await fileBytes('dist/widget.mjs');
    assert.equal(r.headers.get('content-length'), String(plain.length));
    assertBytesEqual(new Uint8Array(await r.arrayBuffer()), plain, 'identity body');
  });

  for (const [encoding, ext] of Object.entries({ br: 'br', gzip: 'gz' })) {
    await check(`/widget.mjs ${encoding} negotiated`, async () => {
      const r = await fetch(`${base}/widget.mjs`, { headers: { 'Accept-Encoding': encoding } });
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('content-encoding'), encoding);
      assert.equal(r.headers.get('vary'), 'Accept-Encoding');
      assert.equal(r.headers.get('content-length'), String((await fileBytes(`dist/widget.mjs.${ext}`)).length));
      assertBytesEqual(
        new Uint8Array(await r.arrayBuffer()),
        await fileBytes('dist/widget.mjs'),
        `decoded ${encoding} body`,
      );
    });
  }

  await check('/loader.js', async () => {
    const r = await fetch(`${base}/loader.js`);
    assert.equal(r.status, 200);
    noPoweredBy(r);
    assert.equal(r.headers.get('content-type'), 'application/javascript');
    assert.equal(r.headers.get('cache-control'), expectedHeaders.root.cacheControl);
    assert.equal(r.headers.get('access-control-allow-origin'), expectedHeaders.root.cors);
    const body = new Uint8Array(await r.arrayBuffer());
    assert.deepEqual(body, await Bun.file(join(ROOT, 'public/loader.js')).bytes());
  });

  await check('/nope 404 still carries CORS+cache headers (add_header ... always)', async () => {
    const r = await fetch(`${base}/nope`);
    assert.equal(r.status, 404);
    noPoweredBy(r);
    assert.equal(
      r.headers.get('access-control-allow-origin'),
      expectedHeaders.root.cors,
      'without `always` nginx drops add_header on non-2xx/3xx, turning a plain 404 into a CORS-blocked one for a customer host',
    );
    assert.equal(r.headers.get('cache-control'), expectedHeaders.root.cacheControl);
  });

  const expectedTag = process.env['EXPECTED_TAG'];
  if (targetUrl && expectedTag) {
    await check(`widget.mjs byte-identity against tag ${expectedTag}`, async () => {
      const scratch = mkdtempSync(join(tmpdir(), 'widget-check-served-'));
      try {
        execFileSync('sh', ['-c', `git archive ${expectedTag} | tar -x -C ${scratch}`], { cwd: ROOT });
        execFileSync('bun', ['install', '--frozen-lockfile'], { cwd: scratch, stdio: 'ignore' });
        execFileSync('bun', ['run', 'build'], { cwd: scratch, stdio: 'ignore' });
        const built = await Bun.file(join(scratch, 'dist/widget.mjs')).bytes();
        const r = await fetch(`${base}/widget.mjs`, { headers: { 'Accept-Encoding': 'identity' } });
        const served = new Uint8Array(await r.arrayBuffer());
        assert.deepEqual(served, built, `${base}/widget.mjs does not match a source build of ${expectedTag}`);
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    });
  }

  console.log(`check:served — ${rows} rows, ${mismatches.length} mismatches${targetUrl ? ` (${targetUrl})` : ''}`);
  if (targetUrl && !expectedTag) {
    console.log(
      `needs-infra: byte-identity against the deployed tag: set EXPECTED_TAG (read from infra's Helm values or the deploy.yml dispatch inputs for ${base}) to run it`,
    );
  }
  if (mismatches.length > 0) {
    for (const mismatch of mismatches) console.error(`- ${mismatch}`);
    process.exitCode = 1;
  }
} finally {
  if (container) spawnSync('docker', ['rm', '-f', container]);
}
