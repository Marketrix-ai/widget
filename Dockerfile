FROM node:24-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM nginx:1.27-alpine
RUN sed -i '/application\/javascript/s/;/ mjs;/' /etc/nginx/mime.types
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

USER nginx
CMD ["nginx", "-g", "daemon off;"]
