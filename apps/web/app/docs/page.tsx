import { A, C, Callout, DocHeader, H2, P, Table, UL } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Introduction" };

export default function DocsIntroduction() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Rivisk documentation"
        lede="Rivisk is shared risk infrastructure for Bitcoin capital on Stacks. It reads a wallet across protocols, normalises the positions, computes deterministic risk, and makes that risk available to your product over an API, a TypeScript SDK, signed webhooks and an on-chain Clarity registry."
      />

      <H2 id="why">Why Rivisk exists</H2>
      <P>
        A wallet&apos;s sBTC can sit in a plain balance, a Zest lending position and a BitPay stream at
        the same time, and every protocol only reports its own slice. A yield router, a lending
        product or an autonomous agent that wants to know whether a wallet is safe would otherwise
        have to index Stacks, read each protocol&apos;s contracts, derive health factors and run
        stress scenarios itself.
      </P>
      <P>
        Rivisk does that once and exposes the answer. The dashboard is one consumer of it; your
        product can be another.
      </P>

      <H2 id="two-paths">Two ways to integrate</H2>
      <Table
        head={["Path", "You get", "Use it when"]}
        rows={[
          [
            <strong key="a">Off-chain</strong>,
            "The full picture over REST or the TypeScript SDK: positions, collateral health, liquidation distance, concentration, stress scenarios, alerts and webhooks.",
            "Your decision runs in a backend, a frontend or an agent.",
          ],
          [
            <strong key="b">On-chain</strong>,
            <>
              A compact attested snapshot read from <C>risk-registry</C> through{" "}
              <C>risk-provider-trait</C>, with a freshness bound that cannot be skipped.
            </>,
            "Your decision runs inside a Clarity contract.",
          ],
        ]}
      />

      <H2 id="today">What is live today</H2>
      <P>Stated precisely, because integrations are built on it:</P>
      <UL>
        <li>
          <strong>The Clarity contracts are live on Stacks testnet</strong>, with a real attestation
          already published and read back by an external contract. See{" "}
          <A href="/docs/contracts">Smart contracts</A>.
        </li>
        <li>
          <strong>The SDK is published</strong> as <C>@rivisk/sdk</C> on npm.
        </li>
        <li>
          <strong>A hosted beta API is live</strong> at <C>https://api.13.49.129.179.sslip.io/api/v1</C>, and it powers the Rivisk
          dashboard. It runs on deliberately small, low-cost infrastructure for the beta: treat it
          as a testing endpoint, not a production service with availability guarantees. You can
          also <A href="/docs/self-hosting">run the whole stack yourself</A>.
        </li>
      </UL>
      <Callout type="note">
        The full breakdown of what is implemented, tested, deployed and validated against live
        chain state is on <A href="/docs/status">Project status</A>.
      </Callout>

      <H2 id="read-it-now">Read an attestation right now</H2>
      <P>
        The testnet registry already holds a snapshot, so this works without running anything. It
        calls the read-only function directly on a public Stacks node:
      </P>
      <CodeBlock
        lang="ts"
        title="read-attestation.mjs"
        code={`
import { Cl, cvToString, deserializeCV, serializeCV } from '@stacks/transactions';

const REGISTRY = 'ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7';
const wallet = 'ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7';

const res = await fetch(
  \`https://api.testnet.hiro.so/v2/contracts/call-read/\${REGISTRY}/risk-registry/get-latest-risk\`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: REGISTRY, arguments: ['0x' + serializeCV(Cl.principal(wallet))] }),
  },
);
const { result } = await res.json();
console.log(cvToString(deserializeCV(result)));
// (ok (some (tuple (health-factor-e4 u3402...) ... (snapshot-id u1) (source-block u454752))))
`}
      />

      <H2 id="next">Where to go next</H2>
      <UL>
        <li>
          <A href="/docs/quickstart">Quickstart</A>: install the SDK and make your first requests.
        </li>
        <li>
          <A href="/docs/concepts">Core concepts</A>: read this before trusting any number. The
          units are fixed-point, and two of them have sentinel values that invert naive checks.
        </li>
        <li>
          <A href="/docs/onchain">Consuming on-chain</A>: if your consumer is a smart contract.
        </li>
      </UL>
    </>
  );
}
