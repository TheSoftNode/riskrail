import { A, C, Callout, DocHeader, H2, H3, P, Table, UL } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Webhooks" };

export default function Webhooks() {
  return (
    <>
      <DocHeader
        eyebrow="Integrate"
        title="Webhooks"
        lede="Rivisk POSTs a signed JSON event to your endpoint whenever a portfolio or its risk changes. Verify the signature on every delivery and answer 2xx."
      />

      <H2 id="register">Registering an endpoint</H2>
      <CodeBlock
        code={`
const { id, secret } = await rivisk.webhooks.create(
  'https://example.com/rivisk',
  ['risk.updated', 'alert.triggered'],
);
// Store \`secret\` (whsec_…) now. It is never shown again.
`}
      />
      <P>
        Takes an API key or a wallet session. The URL must be <C>https</C>; plain <C>http</C> is
        accepted only for <C>localhost</C>. The secret is encrypted at rest with AES-256-GCM, not
        hashed, because Rivisk needs it back to sign each delivery.
      </P>

      <H2 id="events">Events</H2>
      <Table
        head={["Event", "Sent when", <C key="d">data</C>]}
        rows={[
          [<C key="1">portfolio.updated</C>, "A wallet finishes indexing", <C key="d1">{`{ blockHeight, positionCount, valuationCoverageBps }`}</C>],
          [<C key="2">risk.updated</C>, "A new risk snapshot is persisted", <C key="d2">{`{ riskSnapshotId, riskLevel, riskScoreBps, healthFactorE4, reportHash }`}</C>],
          [<C key="3">alert.triggered</C>, "A rule crosses into breach", <C key="d3">{`{ alertEventId, alertRuleId, metric, operator, threshold, value }`}</C>],
          [<C key="4">policy.breached</C>, "A snapshot breaches the wallet's on-chain policy", <C key="d4">{`{ policyBreachEventId, metric, operator, threshold, value }`}</C>],
        ]}
      />
      <H3 id="envelope">Envelope</H3>
      <CodeBlock
        lang="json"
        code={`
{
  "id": "3f8a2c1e-…",
  "type": "risk.updated",
  "address": "SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3",
  "createdAt": "2026-09-21T12:00:00.000Z",
  "data": { "riskLevel": "critical", "riskScoreBps": 9979, "healthFactorE4": 11798, "…": "…" }
}
`}
      />
      <P>
        <C>id</C> is stable across retries of the same event, so use it to deduplicate.
      </P>

      <H2 id="headers">Headers</H2>
      <Table
        head={["Header", "Value"]}
        rows={[
          [<C key="1">rivisk-signature</C>, <><C key="a">t=&lt;unix seconds&gt;,v1=&lt;hex HMAC-SHA256&gt;</C></>],
          [<C key="2">rivisk-event-id</C>, "The envelope id"],
          [<C key="3">rivisk-event-type</C>, "The event name"],
          [<C key="4">rivisk-delivery-attempt</C>, "1 for the first attempt, then 2, 3…"],
          [<C key="5">content-type</C>, <C key="b">application/json</C>],
        ]}
      />

      <H2 id="verify">Verifying a delivery</H2>
      <CodeBlock
        title="route handler"
        code={`
import { constructWebhookEvent, SIGNATURE_HEADER } from '@rivisk/sdk';

export async function POST(req: Request) {
  const raw = await req.text();                // raw body, before JSON.parse
  let event;
  try {
    event = await constructWebhookEvent(raw, req.headers.get(SIGNATURE_HEADER), process.env.RIVISK_WEBHOOK_SECRET!);
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  switch (event.type) {
    case 'risk.updated':    /* … */ break;
    case 'alert.triggered': /* … */ break;
  }
  return new Response('ok');
}
`}
      />
      <P>
        <C>constructWebhookEvent</C> verifies and parses in one step and throws on failure, so an
        unverified body cannot be used by accident. It uses WebCrypto, so it runs on edge runtimes
        as well as Node.
      </P>

      <Callout type="danger" title="Three mistakes everyone makes once">
        <UL>
          <li>
            <strong>Verifying a re-serialised body.</strong> Parsing and re-stringifying changes key
            order and whitespace, so the signature no longer matches. Verify the raw bytes.
          </li>
          <li>
            <strong>Replay.</strong> The timestamp is part of the signed material, so an old body
            cannot be replayed under a new <C>t</C>. Deliveries more than 300 seconds old are
            rejected by default; change it with <C>toleranceSeconds</C>.
          </li>
          <li>
            <strong>Slow handlers.</strong> Each attempt times out after 10 seconds. Acknowledge
            quickly and do the work asynchronously.
          </li>
        </UL>
      </Callout>

      <H3 id="manual">Verifying without the SDK</H3>
      <P>
        Compute <C>{"HMAC-SHA256(secret, `${t}.${rawBody}`)"}</C>, hex-encode it, compare it with{" "}
        <C>v1</C> in constant time, and reject if <C>t</C> is too far from now.
      </P>

      <H2 id="retries">Retries</H2>
      <Table
        head={["Your response", "What Rivisk does"]}
        rows={[
          ["2xx", "Delivered. Done"],
          ["408, 429, 5xx, a timeout or a network failure", "Retries"],
          ["Any other 4xx", "Drops it. A permanent rejection is not retried"],
        ]}
      />
      <P>
        Retries back off <strong>30 seconds, 2 minutes, 10 minutes, then 1 hour</strong>, so there
        are at most five attempts before the delivery is dropped. Every attempt is recorded and
        visible through <C>rivisk.webhooks.list()</C>.
      </P>
      <P>
        Pause an endpoint without deleting it with <C>rivisk.webhooks.setEnabled(id, false)</C>. For
        the endpoints themselves see the <A href="/docs/api#webhooks">REST reference</A>.
      </P>
    </>
  );
}
