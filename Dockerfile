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
RUN npm run build

FROM nginx:1.31.4-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i '/application\/javascript/s/;/ mjs;/' /etc/nginx/mime.types \
    && sed -i 's|/run/nginx.pid|/tmp/nginx.pid|' /etc/nginx/nginx.conf \
    && sed -i '/^user /d' /etc/nginx/nginx.conf \
    && rm -rf /docker-entrypoint.d \
    && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html

EXPOSE 9001

USER nginx
CMD ["nginx", "-g", "daemon off;"]
