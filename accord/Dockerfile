# Accord sync server. Build from the repository root: docker build -t accordsync/server .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@accordsync/server..." \
 && pnpm --filter "@accordsync/server..." run build \
 && pnpm --filter @accordsync/server deploy --legacy --prod /out

FROM node:24-alpine
WORKDIR /app
COPY --from=build /out .
COPY examples/server/ config/
ENV NODE_ENV=production ACCORD_PORT=8080
EXPOSE 8080
USER node
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
# Mount your config folder at /app/config (accord.config.ts can import '@accordsync/server').
CMD ["node", "dist/main.mjs", "serve", "--config", "config/accord.config.ts"]
