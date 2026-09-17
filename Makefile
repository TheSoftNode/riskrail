.PHONY: bootstrap dev build test typecheck infra-up infra-down db-migrate contracts-test

bootstrap:
	corepack enable
	corepack prepare pnpm@10.17.1 --activate
	pnpm install
	pnpm db:generate

infra-up:
	pnpm infra:up

infra-down:
	pnpm infra:down

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

typecheck:
	pnpm typecheck

db-migrate:
	pnpm db:migrate

contracts-test:
	pnpm contracts:test
