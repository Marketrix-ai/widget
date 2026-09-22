# syntax=docker/dockerfile:1.7
# Multi-stage build: `base` installs on bun (deps/build only — this image ships no node binary), `dev`
# runs the Vite dev server for Tilt, `builder` produces the production bundle plus precompressed
# variants, and `runtime` serves the result from nginx. Precompression (gzip + brotli of
# `dist/widget.mjs`, via `scripts/precompress.ts` — the one home for both params, also used by
# `checkServed.ts`'s no-docker fallback) happens in `builder`, not in `bun run build`, because these
# are runtime-image artifacts the npm tarball has no use for. `runtime` copies an explicit allowlist
# rather than all of `dist/`: the sourcemap embeds the entire widget source and the `.d.ts` tree is for
# tsc, so copying the directory would publish all of it into the served image — a new served artifact
# must be added to that COPY by hand.
FROM oven/bun:1.4.2-alpine AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .

FROM base AS dev
EXPOSE 9001
CMD ["bunx", "vite", "dev", "--host", "0.0.0.0", "--port", "9001"]

FROM base AS builder
ENV NODE_ENV=production
RUN bun run build && bun run scripts/precompress.ts dist/widget.mjs

FROM nginx:1.31.5-alpine AS runtime
COPY --from=builder /app/dist/widget.mjs /app/dist/widget.mjs.gz /app/dist/widget.mjs.br /app/dist/loader.js /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i '/application\/javascript/s/;/ mjs;/' /etc/nginx/mime.types \
    && sed -i 's|/run/nginx.pid|/tmp/nginx.pid|' /etc/nginx/nginx.conf \
    && sed -i '/^user /d' /etc/nginx/nginx.conf \
    && rm -rf /docker-entrypoint.d \
    && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html

EXPOSE 9001

USER nginx
CMD ["nginx", "-g", "daemon off;"]
