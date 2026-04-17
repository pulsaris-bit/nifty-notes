# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the Vite app ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
# Note: we intentionally do NOT copy lockfiles. Lovable manages bun.lockb /
# package-lock.json and they can drift from package.json between environments,
# which makes `npm ci` fail inside Docker. `npm install` regenerates a fresh
# tree from package.json and is reliable for container builds.
COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Copy the rest of the source and build
COPY . .

# Inject API base URL at build time so the frontend talks to the API container
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---------- Stage 2: serve the static build with nginx ----------
FROM nginx:1.27-alpine AS runner

# SPA-friendly nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Basic healthcheck against the served index
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
