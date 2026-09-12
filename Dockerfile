# syntax=docker/dockerfile:1.7
# Multi-stage build: `base` installs on bun (deps/build only — this image ships no node binary), `dev`
# runs the Vite dev server for Tilt, `builder` produces the production bundle plus precompressed
# variants, and `runtime` serves the result from nginx. Precompression (gzip + brotli of
# `dist/widget.mjs`) happens in `builder`, not in `bun run build`, because these are runtime-image
# artifacts the npm tarball has no use for; `bun -e` runs it rather than `node -e` since bun implements
# node:zlib/node:fs itself and no node binary exists in this stage. `runtime` copies an explicit
# allowlist rather than all of `dist/`: the sourcemap embeds the entire widget source and the 77
# `.d.ts` files are for tsc, so copying the directory would publish all of it into the served image — a
# new served artifact must be added to that COPY by hand.
FROM oven/bun:1.4.2-alpine AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .

FROM base AS dev
ENV NODE_OPTIONS="--max-old-space-size=256"
EXPOSE 9001
CMD ["bunx", "vite", "dev", "--host", "0.0.0.0", "--port", "9001"]

FROM base AS builder
ENV NODE_ENV=production
RUN bun run build \
    && bun -e "const z=require('zlib'),f=require('fs'),b=f.readFileSync('dist/widget.mjs');f.writeFileSync('dist/widget.mjs.gz',z.gzipSync(b,{level:9}));f.writeFileSync('dist/widget.mjs.br',z.brotliCompressSync(b,{params:{[z.constants.BROTLI_PARAM_QUALITY]:11,[z.constants.BROTLI_PARAM_SIZE_HINT]:b.length}}))"

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
