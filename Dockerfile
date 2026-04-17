# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the Vite app ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* bun.lockb* ./
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

# Copy the rest of the source and build
COPY . .
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
