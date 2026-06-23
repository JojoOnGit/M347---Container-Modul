# ---- Stage 1: build the React app ----
FROM node:20-alpine AS build
WORKDIR /app
COPY app/package*.json ./
RUN npm install
COPY app/ ./
# Production build bakes the placeholder tokens from .env.production into the JS
RUN npm run build

# ---- Stage 2: serve with nginx ----
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /app/build/ .
# Runtime env injection: replace the placeholder tokens before nginx starts
COPY env.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh
EXPOSE 80
# nginx:alpine already runs every executable in /docker-entrypoint.d before starting
