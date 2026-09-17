/**
 * `bun run check:served` — asserts what the RUNTIME IMAGE actually sends a customer host, over real
 * HTTP, against no api: this is a static nginx bundle (`meet`/`personaos`'s `checkServed.ts` boot a
 * Next server instead — same shape, different host). Runs after `build` in `ci`.
 *
 * Local mode (no `TARGET_URL`) builds the `runtime` Docker stage and boots it when `docker` is on
 * `PATH`, since that is the exact artifact `image.yml` ships. Without docker (e.g. a sandboxed dev
 * shell) it falls back to a `Bun.serve` static server that re-derives nginx's own negotiation and
 * header rules from `nginx.conf` — the SAME `expectedHeaders`/`brotliSuffix`/`acceptsGzip` this file
 * uses to assert against either boot, so the fallback can drift from real nginx behavior but never
 * from what this script checks. `TARGET_URL` (e.g. `TARGET_URL=https://widget.marketrix.co bun run
 * check:served`) points the identical row set at an already-running host instead, for deployed
 * parity — only the boot lifecycle changes.
 *
 * Expected `Cache-Control`/`Access-Control-Allow-Origin` values are parsed out of `nginx.conf` itself
 * (`extractBlock` + `headerValue`) rather than a second hardcoded table, so a value changed there is
 * asserted here without anyone remembering to update a duplicate; both locations currently resolve to
 * the same values (no hashed/immutable filename exists to earn a longer TTL — `widget.mjs` and
 * `loader.js` are both served unhashed and revalidate every time), which is a fact about
 * `nginx.conf`'s content, not an assumption baked into this script.
 *
 * Byte-identity against a released tag (`byteIdentityRow`) only runs when both `TARGET_URL` and
 * `EXPECTED_TAG` are set: this repo cannot reach the private infra repo, so the deployed tag is read
 * by a human from infra's Helm values or the `deploy.yml` dispatch inputs and passed in — the check
 * stays read-only and this script never fetches infra itself. It shells to `git archive` the tag into
 * a scratch dir and runs the real `vite build`, so the comparison is against what that tag's source
 * actually produces, not a second copy of the build config.
 *
 * `bootLocal` RETURNS its cleanup handles rather than mutating outer `let`s: a mutation made only inside
 * a called (not inlined) function is invisible to this compiler's flow analysis at the call site, which
 * then narrows the outer binding to `null` and flags any later `?.` access as dead code on `never` — a
 * real TS6 strictness trap, not a runtime bug (closures still work at runtime either way), avoided here
 * by threading the handles back through the return value instead. `BootResult.fallback`'s type is
 * spelled out by hand because Bun's `Server<WebSocketData>` generic resolves to `never` under this
 * tsconfig's strictness when annotated directly, so only the two members this script actually calls are
 * named. Precompression runs host-side too inside `bootLocal` (not just inside the builder stage) since
 * the row checks below compare served bytes against these files regardless of which boot path served
 * them; the no-docker fallback re-derives nginx's own negotiation/header rules so it is held to the same
 * bar rather than a looser one nobody notices drifting, and maps `.js`/`.mjs` to
 * `application/javascript` by hand since nginx's mime.types has no charset param there while Bun sniffs
 * `text/javascript;charset=utf-8`.
 *
 * `fetch` transparently decodes a `br`/`gzip` Content-Encoding (like a browser would), so the decoded
 * body is compared against the plain artifact in every row — proving compression never corrupts content
 * — while the on-disk COMPRESSED artifact's byte size is matched against `Content-Length` to prove which
 * physical file nginx actually picked. `assertBytesEqual` checks length before `assert.deepEqual`:
 * diffing two large, wildly-mismatched byte arrays is pathologically slow to print, so a real corruption
 * must fail on the cheap length compare first.
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
