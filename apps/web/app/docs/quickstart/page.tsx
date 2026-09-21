import { A, C, Callout, DocHeader, H2, P, Step, Steps } from "@/components/docs/prose";
import { CodeBlock, CodeTabs } from "@/components/docs/code-block";

export const metadata = { title: "Quickstart" };

export default function Quickstart() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Quickstart"
        lede="Read a wallet's risk, stress it against a BTC drawdown, and receive a signed event. Assumes a Rivisk API you can reach; there is no public hosted one yet."
      />

      <Callout type="warning" title="Before you start">
        <p>
          You need a running Rivisk API. <A href="/docs/self-hosting">Self-hosting</A> brings one up
          locally with Docker in a few commands. Everything below uses{" "}
          <C>http://localhost:4000/api/v1</C>; substitute your own origin.
        </p>
      </Callout>

      <H2 id="install">Install</H2>
      <CodeBlock lang="bash" code={`npm install @rivisk/sdk`} />
      <P>
        One package, zero runtime dependencies, ESM only, Node 18 or newer. It also runs in
        browsers, Deno, Bun and edge runtimes.
      </P>

      <H2 id="steps">Five steps</H2>
      <Steps>
        <Step title="Create a client">
          <CodeBlock
            code={`
import { RiviskClient } from '@rivisk/sdk';

const rivisk = new RiviskClient({
  baseUrl: process.env.RIVISK_API_URL ?? 'http://localhost:4000/api/v1',
});
`}
          />
          <P>Reads scoped to a public address need no credential at all.</P>
        </Step>

        <Step title="Index a wallet">
          <P>
            A wallet Rivisk has never seen has no snapshot yet. Ask for one. The call returns as
            soon as the job is queued; indexing takes a few seconds.
          </P>
          <CodeBlock
            code={`
const address = 'SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3';
await rivisk.portfolios.refresh(address);   // 202 Accepted
`}
          />
        </Step>

        <Step title="Read its risk">
          <CodeTabs
            tabs={[
              {
                label: "SDK",
                lang: "ts",
                code: `
import { fromE4, bpsToPercent } from '@rivisk/sdk';

const risk = await rivisk.portfolios.risk(address);

risk.riskLevel;                                   // e.g. 'critical'
fromE4(risk.healthFactorE4!);                     // e.g. 1.1798
bpsToPercent(risk.liquidationDistanceBps!);       // e.g. 15.24 (% from liquidation)
risk.sourceBlock;                                 // the Stacks block it describes
`,
              },
              {
                label: "curl",
                lang: "bash",
                code: `curl http://localhost:4000/api/v1/portfolios/SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3/risk`,
              },
            ]}
          />
          <P>
            If the wallet has not been indexed yet this returns <C>404</C>. Refresh, wait a few
            seconds, and read again.
          </P>
        </Step>

        <Step title="Stress it">
          <CodeBlock
            code={`
const result = await rivisk.simulations.run(address, {
  name: 'BTC -20%',
  shocks: [{ symbol: 'sBTC', changeBps: -2000 }],
});

const newlyLiquidatable = result.positions.filter(
  (p) => !p.liquidatableBefore && p.liquidatableAfter,
);
`}
          />
          <P>
            Simulations write nothing, so they are safe to call as often as you like. The SDK
            treats them as idempotent and retries them through transient failures.
          </P>
        </Step>

        <Step title="Receive an event">
          <P>
            Register an endpoint with an API key or a wallet session (see{" "}
            <A href="/docs/authentication">Authentication</A>), then verify every delivery:
          </P>
          <CodeBlock
            title="app/api/rivisk/route.ts"
            code={`
import { constructWebhookEvent, SIGNATURE_HEADER } from '@rivisk/sdk';

export async function POST(req: Request) {
  const raw = await req.text();   // the raw body, before any parsing
  try {
    const event = await constructWebhookEvent(
      raw,
      req.headers.get(SIGNATURE_HEADER),
      process.env.RIVISK_WEBHOOK_SECRET!,
    );
    // event.type: 'risk.updated' | 'alert.triggered' | ...
    return new Response('ok');
  } catch {
    return new Response('bad signature', { status: 400 });
  }
}
`}
          />
        </Step>
      </Steps>

      <H2 id="next">Next</H2>
      <P>
        Read <A href="/docs/concepts">Core concepts</A> before shipping anything that acts on these
        numbers. The API returns integers in fixed-point units, and a wallet with no debt has no
        health factor, which the API reports as <C>null</C>.
      </P>
    </>
  );
}
