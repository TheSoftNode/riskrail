import { A, C, DocHeader, H2, P, Table } from "@/components/docs/prose";

export const metadata = { title: "Project status" };

const LIVE = <strong className="text-healthy">Live-validated</strong>;
const DEPLOYED = <strong className="text-healthy">Deployed</strong>;
const PUBLISHED = <strong className="text-healthy">Published</strong>;
const TESTED = <strong className="text-info">Tested</strong>;
const IMPLEMENTED = <strong className="text-foreground">Implemented</strong>;
const PLANNED = <strong className="text-warning">Planned</strong>;

export default function Status() {
  return (
    <>
      <DocHeader
        eyebrow="Operate"
        title="Project status"
        lede="What exists, and how far each part has been proven. The labels are applied strictly, because an integration is only as solid as the weakest piece it depends on."
      />

      <H2 id="labels">Labels</H2>
      <Table
        head={["Label", "Means"]}
        rows={[
          [IMPLEMENTED, "The code exists and typechecks. Nothing more is claimed"],
          [TESTED, "Covered by automated tests that run in CI"],
          [<>{DEPLOYED} / {PUBLISHED}</>, "Running, or available, somewhere other than a developer machine"],
          [LIVE, "Checked against real chain or protocol state, with the comparison written down"],
          [PLANNED, "Not built"],
        ]}
      />

      <H2 id="onchain">On-chain</H2>
      <Table
        head={["Capability", "Status", "Evidence"]}
        rows={[
          ["Clarity contracts", DEPLOYED, "Stacks testnet, block 451066. clarinet check reports 0 warnings; 51 simnet tests"],
          ["Risk attestations end to end", LIVE, "The worker published snapshot #1 from a live index; its report hash matches the API"],
          ["External contract consumption", LIVE, "risk-consumer-example read snapshot #1 through the trait and approved"],
          ["Mainnet deployment", PLANNED, "After an independent review of the contracts"],
        ]}
      />

      <H2 id="integration">Integration surface</H2>
      <Table
        head={["Capability", "Status", "Evidence"]}
        rows={[
          ["TypeScript SDK", PUBLISHED, <>{<C key="c">@rivisk/sdk@0.1.0</C>} on npm, verified by a clean install from the public registry</>],
          ["REST API", TESTED, "Exercised end to end against real Postgres and Redis by the smoke test"],
          ["Wallet-signature authentication", LIVE, "Real challenge, signature and verification in the smoke test"],
          ["API keys", TESTED, "Accepted for alerts and webhooks, refused for key management, checked live"],
          ["Signed webhooks", TESTED, "Signing, verification, retry classification"],
          ["Realtime", IMPLEMENTED, "Wire protocol matches the gateway; not exercised against a live socket in CI"],
          ["Hosted public API", PLANNED, <>Self-host for now: <A key="s" href="/docs/self-hosting">Self-hosting</A></>],
        ]}
      />

      <H2 id="data">Data and risk</H2>
      <Table
        head={["Capability", "Status", "Evidence"]}
        rows={[
          ["Native Stacks balances", LIVE, "Read from mainnet"],
          ["Zest V2 lending", LIVE, "Debt reproduced to eight significant figures against Zest's own figures for a mainnet obligation"],
          ["BitPay streams", TESTED, "Not yet compared against a live stream"],
          ["Indexer → worker pipeline", LIVE, "A mainnet wallet indexed, scored and persisted end to end"],
          ["Risk engine", LIVE, "Its health factor for a live Zest position matched the protocol's own threshold maths"],
          ["Stress testing", TESTED, "Deterministic presets and custom shocks"],
          ["Market-depth liquidity", PLANNED, "Today's liquidity score measures accessibility, not exit depth"],
          ["Email address verification", PLANNED, "Alerts can currently be sent to an unverified address"],
        ]}
      />

      <P>
        Found something this page overstates? Open an issue at{" "}
        <A href="https://github.com/TheSoftNode/rivisk/issues">github.com/TheSoftNode/rivisk</A>.
      </P>
    </>
  );
}
