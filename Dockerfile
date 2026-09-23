# syntax=docker/dockerfile:1.7
# Widget image: `dev` runs Vite for Tilt, `builder` bundles and precompresses, `runtime` serves via nginx.
# `runtime` copies an explicit allowlist, never all of `dist/`, so sourcemaps and `.d.ts` stay unpublished.
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
