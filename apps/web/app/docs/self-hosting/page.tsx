import { A, C, Callout, DocHeader, H2, P, Step, Steps, Table } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Self-hosting" };

export default function SelfHosting() {
  return (
    <>
      <DocHeader
        eyebrow="Operate"
        title="Self-hosting"
        lede="Run the whole stack yourself: an API, an indexer, a worker and a realtime gateway, backed by Postgres and Redis. There is no public hosted Rivisk API yet, so this is currently the way to integrate off-chain."
      />

      <H2 id="services">Services</H2>
      <Table
        head={["Service", "Does", "Port"]}
        rows={[
          [<C key="1">apps/api</C>, "REST API, auth, rate limiting", <C key="p1">API_PORT</C>],
          [<C key="2">apps/indexer</C>, "Reads wallets through the protocol adapters", "—"],
          [<C key="3">apps/worker</C>, "Scores risk, evaluates alerts, delivers webhooks and email, publishes attestations", "—"],
          [<C key="4">apps/realtime</C>, "Socket.IO gateway for live events", <C key="p4">REALTIME_PORT</C>],
          [<C key="5">apps/web</C>, "The dashboard and these docs", "3000"],
          ["Postgres 16 · Redis 7", "State and queues", "5432 · 6379"],
        ]}
      />

      <H2 id="run">Running it</H2>
      <Steps>
        <Step title="Infrastructure and dependencies">
          <CodeBlock
            lang="bash"
            code={`
git clone https://github.com/TheSoftNode/rivisk && cd rivisk
cp .env.example .env            # then fill in the secrets below
docker compose up -d            # Postgres and Redis
pnpm install
pnpm db:generate
`}
          />
        </Step>
        <Step title="Database">
          <CodeBlock
            lang="bash"
            code={`pnpm --filter @rivisk/database exec prisma migrate deploy --schema prisma/schema.prisma`}
          />
          <P>
            Migrations are committed and checked in CI against a real Postgres, including a drift
            check that fails the build if the schema and the migrations disagree.
          </P>
        </Step>
        <Step title="Build and start">
          <CodeBlock
            lang="bash"
            code={`
pnpm build
node apps/api/dist/main.js
node apps/indexer/dist/main.js
node apps/worker/dist/main.js
node apps/realtime/dist/main.js
`}
          />
        </Step>
        <Step title="Prove it works">
          <CodeBlock
            lang="bash"
            code={`RIVISK_BASE_URL=http://localhost:4000/api/v1 pnpm --filter @rivisk/api smoke`}
          />
          <P>
            The smoke test acts as a wallet: it signs in with a throwaway key, then exercises API
            keys, webhooks, alerts, ownership checks and the key permission boundary against your
            running API. Unit tests mock the database and the queue. This does not. Set{" "}
            <C>STACKS_NETWORK</C> to the API&apos;s network: sign-in checks the address prefix.
          </P>
        </Step>
      </Steps>

      <H2 id="production">Production on one server</H2>
      <P>
        <C>infrastructure/deploy/</C> runs the whole backend from one image with Docker Compose:
        the four services, a one-off migration step, Postgres and Redis on a private network, and
        Caddy in front for automatic HTTPS. Only ports 80 and 443 are published.
      </P>
      <CodeBlock
        lang="bash"
        code={`
cd infrastructure/deploy
./setup-env.sh api.example.com ws.example.com https://your-site.vercel.app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
`}
      />
      <P>
        <C>setup-env.sh</C> generates every secret on the server and never prints one. The{" "}
        <A href="https://github.com/TheSoftNode/rivisk/blob/main/documentation/37-aws-beta-deployment.md">
          AWS runbook
        </A>{" "}
        walks through it on EC2, with the web app on Vercel, backups and Chainhook registration.
      </P>

      <H2 id="env">Environment</H2>
      <Callout type="danger" title="Three secrets, at least 32 characters each">
        <C>JWT_SECRET</C>, <C>API_KEY_PEPPER</C> and <C>WEBHOOK_ENCRYPTION_KEY</C>. A short value
        does not stop the API starting; it fails the first request that needs it, with a{" "}
        <C>500</C>. Generate them with <C>openssl rand -hex 32</C>.
      </Callout>
      <Table
        head={["Variable", "Purpose"]}
        rows={[
          [<C key="1">DATABASE_URL</C>, "Postgres connection string"],
          [<C key="2">REDIS_URL</C>, "Redis, for queues, nonces, rate limits and realtime"],
          [<C key="3">STACKS_NETWORK</C>, <><C key="3a">mainnet</C> or <C key="3b">testnet</C>. Also selects the network attestations are published to</>],
          [<C key="4">STACKS_API_URL</C>, "A Stacks API, e.g. api.hiro.so or api.testnet.hiro.so"],
          [<C key="5">ZEST_V2_ENABLED</C>, <><C key="5a">true</C> to read Zest lending positions. Off by default</>],
          [<C key="6">BITPAY_CORE_CONTRACT</C>, "Enables the BitPay stream adapter"],
          [<C key="7">COINGECKO_API_KEY</C>, "Optional; raises pricing rate limits"],
          [<C key="8">WEB_URL</C>, "Allowed browser origins, comma-separated"],
          [<C key="9">TRUST_PROXY_HOPS</C>, <>Proxies in front of the API. See <A key="e" href="/docs/errors#rate-limits">rate limits</A></>],
          [<C key="10">SMTP_HOST</C>, <>With <C key="10a">SMTP_PORT</C>, <C key="10b">SMTP_USERNAME</C>, <C key="10c">SMTP_PASSWORD</C>, <C key="10d">SMTP_FROM</C>. Email is skipped quietly when unset</>],
          [<C key="11">CHAINHOOK_AUTH_TOKEN</C>, "Bearer token Chainhook must present"],
          [<C key="12">INDEXER_CONCURRENCY</C>, <>Also <C key="12a">RISK_WORKER_CONCURRENCY</C>, <C key="12b">ALERT_WORKER_CONCURRENCY</C>. Default 4</>],
        ]}
      />

      <H2 id="attestations">Publishing attestations</H2>
      <Table
        head={["Variable", "Value"]}
        rows={[
          [<C key="1">RISK_REGISTRY_CONTRACT</C>, <C key="1v">ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7.risk-registry</C>],
          [<C key="2">RISK_POLICY_CONTRACT</C>, <C key="2v">ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7.risk-policy</C>],
          [<C key="3">PROTOCOL_REGISTRY_CONTRACT</C>, <C key="3v">ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7.protocol-registry</C>],
          [<C key="4">RISK_PUBLISHER_ENABLED</C>, <C key="4v">true</C>],
          [<C key="5">RISK_PUBLISHER_SECRET_KEY</C>, "The private key of an authorised publisher. Use a secret manager"],
        ]}
      />
      <P>
        The values above are the public testnet deployment, which you can read from but not
        publish to: only its authorised publisher can write. To publish your own attestations,
        deploy your own copy of the contracts (see the{" "}
        <A href="https://github.com/TheSoftNode/rivisk/blob/main/documentation/36-testnet-deployment.md">
          deployment runbook
        </A>
        ) and authorise your publisher with <C>set-publisher</C>.
      </P>
      <Callout type="warning">
        <C>RISK_PUBLISHER_ENABLED</C> defaults to <C>false</C>. Left that way after deploying, you
        get live contracts and no attestations. The worker logs a warning when publishing is
        enabled but the registry address is empty.
      </Callout>
    </>
  );
}
