# The website builds from this repository alone: the Accord sources its facts
# guard and snippets read live in the committed snapshot accord/ (refresh it
# with `npm run sync:app`; CI's drift job fails when it falls behind the real
# repository). No sibling checkout, no token — any host that clones this
# repository can build it.

# Stage 1: dependencies (clean install for this platform)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: build the static site. `prebuild` copies the brand files (or the
# snapshot's), syncs the snapshot when a sibling checkout exists, and checks
# every claim against the snapshot.
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: serve the static export with Caddy (HTTPS is terminated in front of it)
FROM caddy:2-alpine AS runner
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/out /srv
EXPOSE 3000
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
