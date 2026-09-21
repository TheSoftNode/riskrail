import { A, C, Callout, DocHeader, Endpoint, Fields, H2, P, Table } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "REST API" };

const ADDR = "SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3";

export default function RestApi() {
  return (
    <>
      <DocHeader
        eyebrow="Integrate"
        title="REST API"
        lede="Every endpoint, the credential it takes, its parameters and its response. JSON in, JSON out, under a single versioned prefix."
      />

      <H2 id="basics">Basics</H2>
      <Table
        head={["", ""]}
        rows={[
          ["Base URL", <><C key="b">https://&lt;your-api&gt;/api/v1</C> — locally <C key="l">http://localhost:4000/api/v1</C></>],
          ["Format", "JSON request and response bodies"],
          ["Auth", <><C key="a">Authorization: Bearer &lt;api key or access token&gt;</C> — see <A key="x" href="/docs/authentication">Authentication</A></>],
          ["Addresses", "Stacks principals, validated including the c32 checksum. A mistyped address is a 400, not a queued job"],
          ["Interactive", <>Swagger UI at <C key="s">https://&lt;your-api&gt;/docs</C></>],
        ]}
      />
      <Callout type="note">
        Errors, rate limits and which requests are safe to retry are covered on{" "}
        <A href="/docs/errors">Errors and limits</A>.
      </Callout>

      <H2 id="portfolios">Portfolios and risk</H2>

      <Endpoint id="get-portfolio" method="GET" path="/portfolios/:address" auth="public">
        <P>The latest indexed portfolio: positions, assets and valuation.</P>
        <CodeBlock
          lang="json"
          title="200"
          code={`
{
  "address": "${ADDR}",
  "status": "completed",
  "lastIndexedAt": "2026-09-20T14:04:14.000Z",
  "sourceBlock": "9032803",
  "totalValueUsd": "122815.95",
  "valuationCoverageBps": 4444,
  "byProtocol": { "zest-v2": "121381.09", "native-stacks": "1434.87" },
  "byAsset": { "sBTC": "299879.39", "USDC": "-177064.01" },
  "positions": [
    {
      "id": "…",
      "type": "borrowing",
      "protocol": { "id": "zest-v2", "name": "Zest Protocol V2", "type": "lending" },
      "valueUsd": "121381.08",
      "blockHeight": "9032803",
      "exact": true,
      "assets": [
        { "assetId": "sBTC", "symbol": "sBTC", "role": "collateral", "amountAtomic": "370352796", "decimals": 8, "valueUsd": "298445.09" },
        { "assetId": "USDC", "symbol": "USDC", "role": "debt", "amountAtomic": "177115550075", "decimals": 6, "valueUsd": "177064.00" }
      ]
    }
  ]
}
`}
        />
        <P>
          A wallet that has never been indexed returns <C>200</C> with{" "}
          <C>{`"status": "not-indexed"`}</C>, an empty <C>positions</C> array and a{" "}
          <C>refresh</C> link. <C>amountAtomic</C> is an integer string in the asset&apos;s smallest
          unit; divide by <C>10^decimals</C>.
        </P>
      </Endpoint>

      <Endpoint id="get-risk" method="GET" path="/portfolios/:address/risk" auth="public">
        <P>The latest deterministic risk snapshot.</P>
        <CodeBlock
          lang="json"
          title="200"
          code={`
{
  "address": "${ADDR}",
  "status": "completed",
  "riskLevel": "critical",
  "riskScoreBps": 9979,
  "healthFactorE4": 11798,
  "liquidationDistanceBps": 1524,
  "protocolConcentrationBps": 9970,
  "assetConcentrationBps": 6288,
  "liquidityScoreBps": 30,
  "capitalAccessibilityBps": 30,
  "reportHash": "a5ebf8bc…08d7",
  "methodologyVersion": "rivisk-v1.2",
  "sourceBlock": "9032803",
  "onchain": null
}
`}
        />
        <P>
          <C>404</C> if the wallet has not been indexed. <C>healthFactorE4</C> and{" "}
          <C>liquidationDistanceBps</C> are <C>null</C> when there is no debt. See{" "}
          <A href="/docs/concepts#no-debt">A wallet with no debt</A>. <C>onchain</C> carries the
          attestation <C>txId</C> once the snapshot has been published.
        </P>
      </Endpoint>

      <Endpoint id="refresh" method="POST" path="/portfolios/:address/refresh" auth="public">
        <P>
          Queues a fresh on-chain read and returns immediately; it does not wait for indexing.
          Rate limited to <strong>10 requests per minute per client IP</strong>; over the limit
          returns <C>429</C> with a <C>Retry-After</C> header.
        </P>
        <CodeBlock
          lang="json"
          title="202"
          code={`
{
  "accepted": true,
  "address": "${ADDR}",
  "correlationId": "87bb1734-994e-412c-8782-4acd98814715",
  "statusUrl": "/api/v1/portfolios/${ADDR}"
}
`}
        />
      </Endpoint>

      <H2 id="simulations">Stress testing</H2>

      <Endpoint id="presets" method="GET" path="/simulations/presets" auth="public">
        <Table
          head={[<C key="id">id</C>, "Shock"]}
          rows={[
            [<C key="1">btc-minus-10</C>, "BTC and sBTC −10%"],
            [<C key="2">btc-minus-20</C>, "BTC and sBTC −20%"],
            [<C key="3">btc-minus-30</C>, "BTC and sBTC −30%"],
            [<C key="4">stx-minus-20</C>, "STX −20%"],
          ]}
        />
      </Endpoint>

      <Endpoint id="simulate" method="POST" path="/simulations" auth="public">
        <P>
          Runs a scenario against the latest persisted snapshot. Stateless: nothing is written.
        </P>
        <Fields
          fields={[
            { name: "address", type: "string", required: true, children: "An indexed Stacks address." },
            { name: "name", type: "string", children: "A label, echoed back." },
            {
              name: "shocks",
              type: "array",
              required: true,
              children: (
                <>
                  At least one. Each is <C>{`{ symbol?, assetId?, changeBps }`}</C>, where{" "}
                  <C>changeBps</C> is an integer from <C>-10000</C> (−100%) to <C>100000</C> (+1000%).
                </>
              ),
            },
          ]}
        />
        <CodeBlock
          lang="json"
          title="request"
          code={`{ "address": "${ADDR}", "name": "BTC -20%", "shocks": [{ "symbol": "sBTC", "changeBps": -2000 }] }`}
        />
        <P>
          The response has <C>before</C> and <C>after</C> risk summaries, per-position results with{" "}
          <C>liquidatableBefore</C> / <C>liquidatableAfter</C>, and any <C>warnings</C>.
        </P>
      </Endpoint>

      <H2 id="alerts">Alerts</H2>

      <Endpoint id="list-alerts" method="GET" path="/alerts/:address" auth="public">
        <P>
          Active and paused rules for the address (archived ones are omitted) with their five most
          recent events, plus the last 20 on-chain policy breaches.
        </P>
      </Endpoint>

      <Endpoint id="create-alert" method="POST" path="/alerts/:address" auth="key-or-session">
        <P>
          Creates a rule. The credential&apos;s account must control the address, or the response is{" "}
          <C>403</C>. Rules fire on the snapshot where the metric <strong>crosses</strong> into
          breach, not on every snapshot while it stays there.
        </P>
        <Fields
          fields={[
            {
              name: "metric",
              type: "string",
              required: true,
              children: (
                <>
                  <C>riskScoreBps</C>, <C>healthFactorE4</C>, <C>liquidationDistanceBps</C>,{" "}
                  <C>protocolConcentrationBps</C>, <C>assetConcentrationBps</C>,{" "}
                  <C>liquidityScoreBps</C> or <C>capitalAccessibilityBps</C>.
                </>
              ),
            },
            { name: "operator", type: "string", required: true, children: <><C>lt</C>, <C>lte</C>, <C>gt</C> or <C>gte</C>.</> },
            {
              name: "threshold",
              type: "string",
              required: true,
              children: (
                <>
                  A non-negative decimal string <strong>in the metric&apos;s own units</strong>.
                  To fire below a health factor of 1.30, send <C>&quot;13000&quot;</C>, not{" "}
                  <C>&quot;1.3&quot;</C>.
                </>
              ),
            },
            { name: "channel", type: "string", required: true, children: <>Only <C>in_app</C>. Email delivery follows the account&apos;s notification setting.</> },
          ]}
        />
      </Endpoint>

      <Endpoint id="update-alert" method="PATCH" path="/alerts/:id" auth="key-or-session">
        <Fields
          fields={[
            { name: "status", type: "string", required: true, children: <><C>ACTIVE</C>, <C>PAUSED</C> or <C>ARCHIVED</C>. <C>403</C> if the rule belongs to another account.</> },
          ]}
        />
      </Endpoint>

      <H2 id="policies">On-chain policy</H2>

      <Endpoint id="get-policy" method="GET" path="/policies/:address" auth="public">
        <P>
          The wallet-owned policy read from the <C>risk-policy</C> contract. Wallets set their own
          policy on chain; the API only reads it.
        </P>
        <CodeBlock
          lang="json"
          title="200"
          code={`
{
  "address": "${ADDR}",
  "configured": true,
  "contract": "ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7.risk-policy",
  "policy": {
    "maxRiskScoreBps": 7000, "minHealthFactorE4": 13000,
    "maxProtocolConcentrationBps": 5000, "minLiquidityScoreBps": 4000,
    "enabled": true, "updatedAt": 454753
  }
}
`}
        />
        <P>
          <C>policy</C> is <C>null</C> when the wallet has not set one. <C>configured</C> is{" "}
          <C>false</C> when the instance has no <C>RISK_POLICY_CONTRACT</C>.
        </P>
      </Endpoint>

      <H2 id="webhooks">Webhooks</H2>

      <Endpoint id="list-webhooks" method="GET" path="/webhooks" auth="key-or-session">
        <P>Your endpoints, each with its recent delivery records.</P>
      </Endpoint>

      <Endpoint id="create-webhook" method="POST" path="/webhooks" auth="key-or-session">
        <Fields
          fields={[
            { name: "url", type: "string", required: true, children: <>Absolute <C>https</C> URL. Plain <C>http</C> is accepted only for <C>localhost</C>.</> },
            { name: "events", type: "string[]", required: true, children: <>At least one of <C>portfolio.updated</C>, <C>risk.updated</C>, <C>alert.triggered</C>, <C>policy.breached</C>.</> },
          ]}
        />
        <P>
          The response includes the signing <C>secret</C> (<C>whsec_…</C>).{" "}
          <strong>It is returned once and never again.</strong> Verifying deliveries is covered on{" "}
          <A href="/docs/webhooks">Webhooks</A>.
        </P>
      </Endpoint>

      <Endpoint id="update-webhook" method="PATCH" path="/webhooks/:id" auth="key-or-session">
        <Fields fields={[{ name: "enabled", type: "boolean", required: true, children: "Pause or resume delivery." }]} />
      </Endpoint>

      <Endpoint id="delete-webhook" method="DELETE" path="/webhooks/:id" auth="key-or-session" />

      <H2 id="auth">Authentication and account</H2>

      <Endpoint id="challenge" method="POST" path="/auth/challenge" auth="public">
        <Fields fields={[{ name: "address", type: "string", required: true, children: "The address signing in." }]} />
        <P>Returns <C>{`{ address, message, nonce, expiresIn: 300 }`}</C>. Sign <C>message</C> exactly.</P>
      </Endpoint>

      <Endpoint id="verify" method="POST" path="/auth/verify" auth="public">
        <Fields
          fields={[
            { name: "address", type: "string", required: true, children: "Must match the address the public key hashes to." },
            { name: "publicKey", type: "string", required: true, children: "Compressed secp256k1 public key, hex." },
            { name: "signature", type: "string", required: true, children: "RSV signature over the challenge, hex." },
          ]}
        />
        <P>Returns <C>{`{ userId, address, accessToken, refreshToken, expiresIn }`}</C>.</P>
      </Endpoint>

      <Endpoint id="refresh-token" method="POST" path="/auth/refresh" auth="public">
        <Fields fields={[{ name: "refreshToken", type: "string", required: true, children: "A refresh token from verify or a previous refresh." }]} />
      </Endpoint>

      <Endpoint id="me" method="GET" path="/auth/me" auth="session">
        <P>The account, its notification settings and every wallet linked to it.</P>
      </Endpoint>

      <Endpoint id="update-me" method="PATCH" path="/auth/me" auth="session">
        <Fields
          fields={[
            { name: "email", type: "string", children: <>Notification address. Changing it resets verification. <C>409</C> if another account already uses it.</> },
            { name: "notifyByEmail", type: "boolean", children: "Whether alerts are also emailed." },
          ]}
        />
      </Endpoint>

      <H2 id="keys">API keys</H2>

      <Endpoint id="list-keys" method="GET" path="/api-keys" auth="session">
        <P>Returns <C>{`{ keys: [{ id, name, prefix, lastUsedAt, createdAt }] }`}</C>, never the secret.</P>
      </Endpoint>

      <Endpoint id="create-key" method="POST" path="/api-keys" auth="session">
        <Fields
          fields={[
            { name: "name", type: "string", required: true, children: "A label for your own reference." },
            { name: "live", type: "boolean", children: <><C>true</C> for <C>rv_live_</C>, otherwise <C>rv_test_</C>.</> },
          ]}
        />
        <P>The <C>token</C> in the response is shown once.</P>
      </Endpoint>

      <Endpoint id="revoke-key" method="DELETE" path="/api-keys/:id" auth="session" />

      <H2 id="health">Health</H2>
      <Endpoint id="health-live" method="GET" path="/health" auth="public">
        <P>Liveness: <C>{`{ status: "ok", service: "rivisk-api", timestamp }`}</C>.</P>
      </Endpoint>
      <Endpoint id="health-ready" method="GET" path="/health/ready" auth="public">
        <P>Readiness: <C>{`{ status: "ready" }`}</C>.</P>
      </Endpoint>

      <Callout type="note" title="Chainhook receivers">
        <C>POST /chainhook/risk-registry</C>, <C>/chainhook/risk-policy</C> and{" "}
        <C>/chainhook/protocol</C> are internal: they receive Chainhook deliveries and require{" "}
        <C>CHAINHOOK_AUTH_TOKEN</C>. They are not part of the integration surface.
      </Callout>
    </>
  );
}
