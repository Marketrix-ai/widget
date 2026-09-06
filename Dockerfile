# syntax=docker/dockerfile:1.7
FROM node:26-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .

FROM base AS dev
ENV NODE_OPTIONS="--max-old-space-size=256"
EXPOSE 9001
CMD ["npx", "vite", "dev", "--host", "0.0.0.0", "--port", "9001"]

FROM base AS builder
ENV NODE_ENV=production
# Precompressed here, not in `npm run build`: these are runtime-image artifacts and the npm tarball
# has no use for them.
RUN npm run build \
    && node -e "const z=require('zlib'),f=require('fs'),b=f.readFileSync('dist/widget.mjs');f.writeFileSync('dist/widget.mjs.gz',z.gzipSync(b,{level:9}));f.writeFileSync('dist/widget.mjs.br',z.brotliCompressSync(b,{params:{[z.constants.BROTLI_PARAM_QUALITY]:11,[z.constants.BROTLI_PARAM_SIZE_HINT]:b.length}}))"

FROM nginx:1.31.5-alpine AS runtime
# An allowlist, not `dist/`: the sourcemap embeds the entire widget source and the 77 .d.ts files
# are for tsc, yet copying the directory published all of it. A new served artifact must be added here.
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
