/**
 * `bun run check:served` — checks what the runtime image actually sends a customer host over real
 * HTTP, rather than trusting the build config to describe it. Runs after `build` in CI.
 *
 * Boots the `runtime` Docker image when docker is available, or falls back to a small `Bun.serve`
 * static server that mimics nginx's own header and compression rules when it isn't. `TARGET_URL`
 * points the same checks at an already-deployed host instead of a local boot; adding `EXPECTED_TAG`
 * also verifies the served bundle is byte-identical to a source build of that tag.
 *
 * Expected cache/CORS headers are read out of `nginx.conf` itself rather than duplicated here, so a
 * config change can't silently drift from what this script asserts.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const widgetBlock = extractBlock('location = /widget.mjs {');
const rootBlock = extractBlock('location / {');
const expectedHeaders = {
  widget: {
    cacheControl: headerValue(widgetBlock, 'Cache-Control'),
    cors: headerValue(widgetBlock, 'Access-Control-Allow-Origin'),
  },
  root: {
    cacheControl: headerValue(rootBlock, 'Cache-Control'),
    cors: headerValue(rootBlock, 'Access-Control-Allow-Origin'),
  },
};

const acceptsToken = (acceptEncoding: string, token: string): boolean =>
  new RegExp(`\\b${token}\\b(?!\\s*;\\s*q=0)`, 'i').test(acceptEncoding);
const brotliSuffix = (acceptEncoding: string): '.br' | '' => (acceptsToken(acceptEncoding, 'br') ? '.br' : '');

const targetUrl = process.env['TARGET_URL'];
const hasDocker = !targetUrl && spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const IMAGE = 'widget-check-served:local';

interface BootResult {
  base: string;
  container: string | null;
  fallback: { url: URL; stop: (closeActiveConnections?: boolean) => void } | null;
}

async function bootLocal(): Promise<BootResult> {
  if (!existsSync(join(ROOT, 'dist/widget.mjs')))
    throw new Error('dist/widget.mjs missing — run `bun run build` first');
  precompress(join(ROOT, 'dist/widget.mjs'));

  if (hasDocker) {
    execFileSync('docker', ['build', '--target', 'runtime', '-t', IMAGE, '.'], { cwd: ROOT, stdio: 'inherit' });
    const container = execFileSync('docker', ['run', '-d', '-P', IMAGE]).toString().trim();
    const port = execFileSync('docker', ['port', container, '9001/tcp'])
      .toString()
      .trim()
      .split('\n')[0]
      ?.split(':')
      .pop();
    const base = `http://localhost:${port}`;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if ((await fetch(`${base}/health`).catch(() => null))?.ok) return { base, container, fallback: null };
      await Bun.sleep(200);
    }
    throw new Error('runtime container never answered /health');
  }

  const fallback = Bun.serve({
    port: 0,
    fetch: async request => {
      const url = new URL(request.url);
      const acceptEncoding = request.headers.get('accept-encoding') ?? '';
      const withCors = (response: Response, target: 'widget' | 'root'): Response => {
        response.headers.set('Access-Control-Allow-Origin', expectedHeaders[target].cors);
        response.headers.set('Cache-Control', expectedHeaders[target].cacheControl);
        return response;
      };
      if (url.pathname === '/health') return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
      if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });
      if (url.pathname === '/widget.mjs') {
        const suffix = brotliSuffix(acceptEncoding);
        const encoding = suffix === '.br' ? 'br' : acceptsToken(acceptEncoding, 'gzip') ? 'gzip' : '';
        const file = Bun.file(join(ROOT, `dist/widget.mjs${encoding === 'gzip' ? '.gz' : suffix}`));
        const headers: Record<string, string> = { 'Content-Type': 'application/javascript', Vary: 'Accept-Encoding' };
        if (encoding) headers['Content-Encoding'] = encoding;
        return withCors(new Response(await file.bytes(), { headers }), 'widget');
      }
      const file = Bun.file(join(ROOT, 'dist', url.pathname));
      if (!(await file.exists())) return withCors(new Response('404 Not Found', { status: 404 }), 'root');
      const contentType = /\.m?js$/.test(url.pathname)
        ? 'application/javascript'
        : (file.type.split(';')[0] ?? file.type);
      return withCors(new Response(await file.bytes(), { headers: { 'Content-Type': contentType } }), 'root');
    },
  });
  return { base: fallback.url.toString().replace(/\/$/, ''), container: null, fallback };
}

let container: BootResult['container'] = null;
let fallback: BootResult['fallback'] = null;

try {
  let base = targetUrl;
  if (!base) ({ base, container, fallback } = await bootLocal());
  let rows = 0;
  const mismatches: string[] = [];
  const needsInfra: string[] = [];

  const check = async (label: string, run: () => Promise<void>) => {
    rows += 1;
    try {
      await run();
    } catch (error) {
      mismatches.push(`${label}: ${(error as Error).message}`);
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

  await check('/widget.mjs brotli negotiated', async () => {
    const r = await fetch(`${base}/widget.mjs`, { headers: { 'Accept-Encoding': 'br' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-encoding'), 'br');
    assert.equal(r.headers.get('vary'), 'Accept-Encoding');
    assert.equal(r.headers.get('content-length'), String((await fileBytes('dist/widget.mjs.br')).length));
    assertBytesEqual(new Uint8Array(await r.arrayBuffer()), await fileBytes('dist/widget.mjs'), 'decoded brotli body');
  });

  await check('/widget.mjs gzip negotiated (no brotli offered)', async () => {
    const r = await fetch(`${base}/widget.mjs`, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-encoding'), 'gzip', 'gzip_static must cover the non-brotli case');
    assert.equal(r.headers.get('content-length'), String((await fileBytes('dist/widget.mjs.gz')).length));
    assertBytesEqual(new Uint8Array(await r.arrayBuffer()), await fileBytes('dist/widget.mjs'), 'decoded gzip body');
  });

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
  } else if (targetUrl) {
    needsInfra.push(
      `byte-identity against the deployed tag: set EXPECTED_TAG (read from infra's Helm values or the deploy.yml dispatch inputs for ${base}) to run it`,
    );
  }

  const summary = `check:served — ${rows} rows, ${mismatches.length} mismatches${targetUrl ? ` (${targetUrl})` : ''}`;
  console.log(summary);
  for (const item of needsInfra) console.log(`needs-infra: ${item}`);
  if (mismatches.length > 0) {
    for (const mismatch of mismatches) console.error(`- ${mismatch}`);
    process.exitCode = 1;
  }
} finally {
  fallback?.stop(true);
  if (container) spawnSync('docker', ['rm', '-f', container]);
}
