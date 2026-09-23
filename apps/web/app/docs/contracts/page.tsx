import { A, C, Callout, DocHeader, H2, H3, P, Table } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Smart contracts" };

const DEPLOYER = "ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7";
const tx = (id: string) => `https://explorer.hiro.so/txid/${id}?chain=testnet`;
const contract = (name: string) => `https://explorer.hiro.so/txid/${DEPLOYER}.${name}?chain=testnet`;

const DEPLOYED = [
  { name: "risk-provider-trait", role: "The stable interface external contracts integrate against", tx: "0x2741ae553e1ac9f1583bb6d2e970a9412de56cbbc92f3e79af60d85d7e4b44a4" },
  { name: "risk-registry", role: "Append-only risk attestations; implements the trait", tx: "0xdc84a6068b60d391395c71ab3766be66273ac690ba8b2e879a6412a92c2271bb" },
  { name: "risk-policy", role: "Wallet-owned risk guardrails", tx: "0x4edfdd1f184cddf0ee41f1fe40875bf8ef1729202309c1948a313bd820f1c937" },
  { name: "protocol-registry", role: "Which protocols Rivisk has an adapter for", tx: "0x2f73c647568bb7b807c0812bef47e0c68e7f16b104f9ea555138e254a19e664a" },
  { name: "risk-consumer-example", role: "Reference consumer, not part of the protocol", tx: "0x83581fb90bf6f57c3937d9492df0e5a16bdcf4223772946512ef2a8f795ee4b7" },
];

export default function Contracts() {
  return (
    <>
      <DocHeader
        eyebrow="On-chain"
        title="Smart contracts"
        lede="Four Clarity contracts and a reference consumer, live on Stacks testnet. None of them custody assets: risk is computed off chain and only a compact, verifiable summary is written."
      />

      <H2 id="deployment">Testnet deployment</H2>
      <Table
        head={["", ""]}
        rows={[
          ["Network", "Stacks testnet"],
          ["Deployer / owner", <C key="d">{DEPLOYER}</C>],
          ["Authorised publisher", <C key="p">ST3YFXHB07XYK0XZWE43JCDBEYFKTR7SXEK41TJ75</C>],
          ["Deployed", "2026-09-21, block 451066"],
          ["Clarity", "Version 5, epoch 3.4"],
        ]}
      />
      <Table
        head={["Contract", "Role", "Deploy tx"]}
        rows={DEPLOYED.map((c) => [
          <A key={c.name} href={contract(c.name)}>{c.name}</A>,
          c.role,
          <A key={`${c.name}-tx`} href={tx(c.tx)}>{`${c.tx.slice(0, 10)}…`}</A>,
        ])}
      />
      <Callout type="success" title="Proven on chain">
        <p>
          The worker published snapshot #1 to <C>risk-registry</C> from a live index (
          <A href={tx("0x0877e7b2a15bbea25fba100f14bea0321d2cfdab3c2278b627026cba93981e55")}>tx</A>),
          and <C>risk-consumer-example</C> read it through the trait and approved (
          <A href={tx("0xb4bb63a603dc64264a060ede3f5f3f9f4ce95874c10accfa9bf8d5c4a901d911")}>tx</A>).
          The on-chain report hash matches the one the API stores.
        </p>
      </Callout>
      <Callout type="note" title="Old name in the source comments">
        The contracts were deployed before the project was renamed, so their source comments still
        say &ldquo;RiskRail&rdquo;. Contract names and behaviour carry no brand, and the repository copy
        is kept byte-for-byte identical to what is on chain.
      </Callout>

      <H2 id="lifecycle">Deployment lifecycle</H2>
      <P>
        These are the <strong>beta v1</strong> contracts. They work — attestations are published
        against them and an external consumer has read one through the trait — but that is not a
        claim that the design is final. An independent security and readiness review is planned
        grant work (<A href="/docs/grant-scope">Grant scope</A>), and a Clarity contract cannot be
        edited in place:
      </P>
      <CodeBlock
        lang="text"
        code={`
testnet v1 (today)
      ↓  independent contract / security review
      ↓  fix findings, improve the design where needed
      ↓  redeploy to testnet if the code changed
      ↓  re-run contract and integration validation
mainnet, if no blocking finding remains
`}
      />
      <P>
        So any change the review calls for means a new deployment and a fresh validation pass on
        testnet before mainnet. Integrate against the <strong>trait</strong> rather than a hardcoded
        address, and a new registry version costs you a configuration change rather than a rewrite.
      </P>

      <H2 id="trait">risk-provider-trait</H2>
      <P>
        The interface to integrate against. A trait cannot change once deployed, so this surface is
        meant to be the one that lasts. Take it as an argument rather than hardcoding the registry
        (see <A href="/docs/onchain">Consuming on-chain</A>).
      </P>
      <Table
        head={["Function", "Returns"]}
        rows={[
          [<C key="1">get-risk-if-fresh (wallet, max-age-blocks)</C>, <>The snapshot, or <C key="n">none</C> if it is older than the bound. <strong key="s">Build decisions on this one.</strong></>],
          [<C key="2">get-latest-risk (wallet)</C>, "The latest snapshot tuple, whatever its age"],
          [<C key="3">is-snapshot-fresh (wallet, max-age-blocks)</C>, "bool"],
          [<C key="4">get-latest-risk-score · -health-factor · -liquidation-distance · -protocol-concentration · -liquidity-score · -source-block · -report-hash</C>, "One field each, with no freshness check"],
        ]}
      />
      <H3 id="snapshot">Snapshot tuple</H3>
      <CodeBlock
        lang="clarity"
        code={`
{
  snapshot-id: uint,
  risk-score-bps: uint,               ;; 0..10000, 10000 = maximum risk
  health-factor-e4: uint,             ;; 1.47 -> u14700; max uint = no debt
  liquidation-distance-bps: uint,     ;; 0..10000; u10000 = no debt
  protocol-concentration-bps: uint,   ;; largest single-protocol share
  liquidity-score-bps: uint,          ;; 0..10000, 10000 = most accessible
  source-block: uint,                 ;; block the chain state was read at
  report-hash: (buff 32),             ;; SHA-256 of the canonical report
  published-at: uint                  ;; block the attestation was written in
}
`}
      />

      <H2 id="registry">risk-registry</H2>
      <Table
        head={["Function", "Kind", "Who"]}
        rows={[
          [<C key="1">publish-risk-snapshot</C>, "public", "Authorised publishers"],
          [<C key="2">set-publisher (publisher, enabled)</C>, "public", "Owner"],
          [<C key="3">transfer-ownership · accept-ownership · cancel-ownership-transfer</C>, "public", "Owner / nominee"],
          [<C key="4">get-snapshot (wallet, id) · get-latest-snapshot-id · get-latest-snapshot</C>, "read-only", "Anyone"],
          [<C key="5">is-authorized-publisher · get-owner · get-pending-owner</C>, "read-only", "Anyone"],
          [<C key="6">get-unbounded-health-factor · get-max-liquidation-distance</C>, "read-only", "The no-debt sentinels, by name"],
          ["All trait functions", "read-only", "Anyone"],
        ]}
      />
      <P>
        Snapshots are <strong>append-only</strong>. Publishing never overwrites an earlier snapshot,
        so every past attestation stays addressable by id and verifiable, even after a publisher
        is revoked. A snapshot is rejected if its <C>source-block</C> is ahead of the current
        chain, which also means mainnet state cannot be attested into the testnet registry.
      </P>

      <H2 id="policy">risk-policy</H2>
      <P>Each wallet writes its own policy; every call acts on <C>tx-sender</C> only.</P>
      <Table
        head={["Function", "Notes"]}
        rows={[
          [<C key="1">set-risk-policy (max-risk-score-bps, min-health-factor-e4, max-protocol-concentration-bps, min-liquidity-score-bps)</C>, <>bps fields ≤ 10000; <C key="h">min-health-factor-e4</C> ≤ 1000000 (100.00)</>],
          [<C key="2">set-policy-enabled (enabled)</C>, "Pause or resume evaluation"],
          [<C key="3">delete-risk-policy</C>, "Remove it entirely"],
          [<C key="4">get-risk-policy (wallet) · get-max-min-health-factor</C>, "read-only"],
        ]}
      />

      <H2 id="protocols">protocol-registry</H2>
      <P>
        Records which protocols Rivisk has an adapter for, and at what version.{" "}
        <strong>It does not mean a protocol endorses Rivisk.</strong> <C>metadata-hash</C> pins the
        adapter descriptor, so a consumer can tell whether a protocol&apos;s interpretation changed
        between two snapshots.
      </P>
      <Table
        head={[<C key="id">id</C>, "Protocol", "Type", "Adapter"]}
        rows={[["u1", "Zest Protocol V2", "lending", "v1"]]}
      />
      <P>
        Functions: <C>register-protocol</C>, <C>set-protocol-enabled</C>,{" "}
        <C>set-adapter-version</C> and the same two-step ownership functions (owner only);{" "}
        <C>get-protocol</C> and <C>is-supported-protocol</C> (read-only). Disabling a protocol keeps
        its entry, so snapshots taken while it was live stay explicable.
      </P>

      <H2 id="ownership">Two-step ownership</H2>
      <P>
        Both registries move ownership in two steps. The owner nominates, and nothing changes until
        the nominee claims it, so a mistyped address cannot permanently lock out the ability to
        authorise or revoke publishers.
      </P>
      <CodeBlock
        lang="clarity"
        code={`
(contract-call? .risk-registry transfer-ownership 'ST2NEW...)   ;; owner nominates
(contract-call? .risk-registry accept-ownership)                 ;; nominee claims it
`}
      />

      <H2 id="errors">Error codes</H2>
      <Table
        head={["Code", "Contract", "Meaning"]}
        rows={[
          [<C key="1">u100</C>, "risk-registry", "Not the owner or an authorised publisher"],
          [<C key="2">u101</C>, "risk-registry", "Risk score above 10000"],
          [<C key="3">u102</C>, "risk-registry", "A bps value above 10000"],
          [<C key="4">u103</C>, "risk-registry", "Source block is ahead of the chain"],
          [<C key="5">u200</C>, "risk-policy", "Risk score above 10000"],
          [<C key="6">u201</C>, "risk-policy", "A bps value above 10000"],
          [<C key="7">u202</C>, "risk-policy", "Minimum health factor above 1000000"],
          [<C key="8">u300</C>, "protocol-registry", "Not the owner"],
          [<C key="9">u301</C>, "protocol-registry", "Protocol id already registered"],
          [<C key="10">u302</C>, "protocol-registry", "Protocol id not found"],
          [<C key="11">u400</C>, "risk-consumer-example", "No fresh risk for the wallet"],
          [<C key="12">u401</C>, "risk-consumer-example", "Health factor below the consumer's minimum"],
          [<C key="13">u402</C>, "risk-consumer-example", "Portfolio too concentrated"],
        ]}
      />
    </>
  );
}
