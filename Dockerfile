# syntax=docker/dockerfile:1.7
# Widget image: `builder` bundles and precompresses, `runtime` serves via nginx.
# `runtime` copies an explicit allowlist, never all of `dist/`, so sourcemaps and `.d.ts` stay unpublished.
ARG BUN_VERSION
FROM oven/bun:${BUN_VERSION}-alpine AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .

FROM base AS builder
ENV NODE_ENV=production
RUN bun run build && bun run scripts/precompress.ts dist/widget.mjs

FROM nginxinc/nginx-unprivileged:1.31.6-alpine AS runtime
COPY --from=builder /app/dist/widget.mjs /app/dist/widget.mjs.gz /app/dist/widget.mjs.br /app/dist/loader.js /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i '/application\/javascript/s/;/ mjs;/' /etc/nginx/mime.types
EXPOSE 9001
