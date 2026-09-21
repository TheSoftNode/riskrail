# One image for every backend service. Compose picks the process per service:
#   node apps/api/dist/main.js | apps/indexer | apps/worker | apps/realtime
#
# Build from the repository root:
#   docker build -f infrastructure/docker/Dockerfile -t rivisk-backend .
FROM node:22-bookworm-slim AS build
# Prisma's query engine links against OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.17.1
WORKDIR /app

# Download dependencies from the lockfile alone, so this layer is reused until
# the lockfile changes instead of on every source edit.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile
COPY . .
RUN pnpm install --frozen-lockfile --offline
# The client is generated from the schema, not installed, so it has to be
# produced before anything that imports @rivisk/database compiles.
RUN pnpm --filter @rivisk/database db:generate
# `...` builds each app together with every workspace package it imports.
RUN pnpm exec turbo run build \
  --filter=@rivisk/api... --filter=@rivisk/indexer... \
  --filter=@rivisk/worker... --filter=@rivisk/realtime...

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.17.1
ENV NODE_ENV=production
WORKDIR /app
# The Prisma CLI stays in the image so the migrate service can run it.
COPY --from=build /app /app
USER node
CMD ["node", "apps/api/dist/main.js"]
