# syntax=docker/dockerfile:1.7
# Multi-stage build, same shape as the Yoon website: deps → build → Caddy.
# Unlike Yoon there is no committed snapshot of the sources the facts guard
# reads: the Accord repository comes in as an extra build context (see
# docker-compose.yml, `accord: ../app`) and plan.md is mounted as a build
# secret from ../plan.md. So the Docker build still runs check-facts against
# the real sources — a Docker build requires the same sibling checkout as a
# normal `npm run build`.

# Stage 1: dependencies (clean install for this platform)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: build the static site. `prebuild` runs copy-brand (the committed
# public/brand/ files are used until the owner moves them to app/docs/assets/)
# and check-facts against /accord + the mounted plan.md.
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The Accord repository, without its installs and git history.
COPY --from=accord --exclude=node_modules --exclude=**/node_modules --exclude=.git / /accord
RUN --mount=type=secret,id=accord_plan,target=/plan.md,required=true \
    ACCORD_APP_DIR=/accord ACCORD_PLAN_FILE=/plan.md npm run build

# Stage 3: serve the static export with Caddy (HTTPS is terminated in front of it)
FROM caddy:2-alpine AS runner
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/out /srv
EXPOSE 3000
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
