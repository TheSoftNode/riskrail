# Build from repository root: docker build --build-arg FILTER=@riskrail/api -f infrastructure/docker/Dockerfile .
FROM node:22-alpine AS build
ARG FILTER=@riskrail/api
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter ${FILTER} build

FROM node:22-alpine AS runtime
ARG FILTER=@riskrail/api
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
COPY --from=build /app /app
ENV APP_FILTER=${FILTER}
CMD ["sh", "-c", "pnpm --filter ${APP_FILTER} start"]
