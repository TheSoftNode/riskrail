import { A, C, Callout, DocHeader, H2, H3, P, Table, UL } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Core concepts" };

export default function Concepts() {
  return (
    <>
      <DocHeader
        eyebrow="Getting started"
        title="Core concepts"
        lede="The model behind every number Rivisk returns. Read this before acting on one: the units are fixed-point, and two of them use sentinel values that invert a naive comparison."
      />

      <H2 id="pipeline">From a wallet to a risk snapshot</H2>
      <P>Every figure comes out of the same four stages, in order:</P>
      <Table
        head={["Stage", "What happens", "Output"]}
        rows={[
          [<strong key="1">Discover</strong>, "One adapter per protocol reads the wallet's on-chain state at a specific block.", <C key="a">NormalizedPosition[]</C>],
          [<strong key="2">Value</strong>, "Assets are priced; debt is subtracted from equity rather than counted as value.", "Portfolio value, per-protocol and per-asset totals"],
          [<strong key="3">Score</strong>, "Deterministic formulas: collateral health, liquidation distance, concentration, accessibility.", <C key="b">RiskSnapshot</C>],
          [<strong key="4">Attest</strong>, "The canonical report is hashed with SHA-256 and, when publishing is enabled, written to the Clarity registry.", "Report hash, on-chain snapshot"],
        ]}
      />
      <P>
        Nothing is a model or an opinion: the same inputs always produce the same numbers. The
        methodology version is carried on every snapshot (currently <C>rivisk-v1.2</C>), so a
        change in the formulas is visible in the data.
      </P>

      <H2 id="adapters">Adapters</H2>
      <P>
        Each protocol is read by an adapter that emits the same normalised position shape. Nothing
        above the adapter knows which protocol a position came from, which is why a new venue does
        not change the engine, the API or the SDK.
      </P>
      <Table
        head={["Adapter", "Reads", "Enabled by"]}
        rows={[
          ["Native Stacks", "STX and SIP-010 balances, including sBTC", "Always on"],
          ["Zest Protocol V2", "Lending obligations: collateral, scaled debt, the position's own LTV thresholds", <C key="z">ZEST_V2_ENABLED=true</C>],
          ["BitPay", "Payment streams: locked, vested, withdrawable sBTC", <C key="b">BITPAY_CORE_CONTRACT=…</C>],
        ]}
      />
      <Callout type="warning">
        Zest and BitPay are <strong>off unless configured</strong>. Without those variables the
        indexer reads native balances only and says nothing about it, so a lending position would
        simply be missing.
      </Callout>

      <H2 id="units">Units</H2>
      <P>
        The API sends integers so nothing is lost to floating point. There are three conventions,
        and the SDK exports helpers for each.
      </P>
      <Table
        head={["Field", "Meaning", "Example", "SDK helper"]}
        rows={[
          [<C key="1">*Bps</C>, "Basis points. 10000 = 100%.", "4400 → 44%", <C key="h1">fromBps</C>],
          [<C key="2">healthFactorE4</C>, "Health factor × 10000.", "14700 → 1.47", <C key="h2">fromE4</C>],
          ["Money", <>Decimal <strong>strings</strong>, never numbers.</>, <C key="m">&quot;121381.09&quot;</C>, "Parse with a decimal library"],
        ]}
      />
      <CodeBlock
        code={`
import { fromE4, bpsToPercent } from '@rivisk/sdk';

fromE4(14700);          // 1.47
bpsToPercent(4400);     // 44
`}
      />

      <H2 id="health-factor">Health factor and liquidation distance</H2>
      <P>
        For a lending position, the <strong>health factor</strong> compares the position with the
        protocol&apos;s own partial-liquidation threshold. Above 1.00 the position is clear of it;
        at or below 1.00 it has crossed and may be liquidated. <strong>Liquidation distance</strong>{" "}
        is how far the collateral price can fall before that happens.
      </P>
      <P>
        Both are estimates. Rivisk marks positions to its own price source, while a protocol
        liquidates on its own oracle, so the figures can differ from the protocol&apos;s screen by the
        spread between the two.
      </P>

      <H3 id="no-debt">A wallet with no debt</H3>
      <P>
        It has no health factor and nothing to liquidate. The two surfaces report that
        differently, and both are chosen so that a careless reader treats the wallet as{" "}
        <strong>safe</strong>:
      </P>
      <Table
        head={["Surface", <C key="h">healthFactorE4</C>, <C key="l">liquidationDistanceBps</C>]}
        rows={[
          ["REST API / SDK", <C key="a">null</C>, <C key="b">null</C>],
          ["On-chain registry", <C key="c">u340282366920938463463374607431768211455</C>, <C key="d">u10000</C>],
        ]}
      />
      <Callout type="danger" title="Never treat absent as zero">
        <p>
          Zero would invert every safety check. <C>(&gt;= health-factor u12500)</C> with a zero
          would reject a debt-free wallet as the most dangerous position on the chain. On the API,
          handle <C>null</C> explicitly. On chain, the maximum uint makes the naive comparison
          correct.
        </p>
      </Callout>

      <H2 id="risk-levels">Risk levels</H2>
      <P>
        <C>riskLevel</C> is derived from the worst health factor across the wallet&apos;s lending
        positions. Only when there is no lending position does it fall back to the composite risk
        score.
      </P>
      <Table
        head={["Level", "With a lending position", "Without one (risk score)"]}
        rows={[
          [<strong key="c" className="text-critical">critical</strong>, "health factor < 1.20", "≥ 7500 bps"],
          [<strong key="e" className="text-high">elevated</strong>, "1.20 – 1.50", "5000 – 7499"],
          [<strong key="m" className="text-warning">moderate</strong>, "1.50 – 2.00", "2500 – 4999"],
          [<strong key="h" className="text-healthy">healthy</strong>, "≥ 2.00", "< 2500"],
          [<strong key="u">unknown</strong>, "not enough data", "not enough data"],
        ]}
      />

      <H2 id="concentration">Concentration and accessibility</H2>
      <UL>
        <li>
          <strong>Protocol concentration</strong>: the largest single protocol&apos;s share of the
          portfolio. 9970 bps means 99.7% sits in one venue.
        </li>
        <li>
          <strong>Asset concentration</strong>: the same, by asset.
        </li>
        <li>
          <strong>Capital accessibility</strong> and <strong>liquidity score</strong>: how much of
          the portfolio is spendable now, as opposed to locked as collateral or unvested in a
          stream. This is an accessibility measure, <strong>not</strong> market depth. It does not
          tell you what price you could exit at.
        </li>
      </UL>

      <H2 id="coverage">Valuation coverage</H2>
      <P>
        <C>valuationCoverageBps</C> is the share of <strong>assets</strong> that could be priced. It
        counts assets, not value: a wallet holding $300k of priced sBTC and five unpriced meme
        tokens reports low coverage even though almost all of its value is priced. The rule is
        deliberately conservative: an unpriced debt asset must never hide behind a partly valued
        position.
      </P>

      <H2 id="blocks">Source block and freshness</H2>
      <P>
        Every snapshot records the <C>sourceBlock</C> the chain state was read at. On chain, a
        snapshot also records <C>published-at</C>, the block it was written in. Freshness is
        measured from <C>published-at</C>; the data describes <C>source-block</C>.
      </P>
      <Callout type="note" title="Blocks are fast">
        Stacks blocks arrive every few seconds, not every ten minutes. On testnet we measured{" "}
        <strong>9.6 seconds per block</strong>, so 144 blocks is about 23 minutes, not a day. See{" "}
        <A href="/docs/onchain#freshness">choosing a freshness bound</A>.
      </Callout>

      <H2 id="report-hash">Report hash</H2>
      <P>
        The full risk report is canonicalised (object keys sorted, recursively), serialised as JSON
        and hashed with SHA-256. The hash is stored with the snapshot and, when attested, on chain.
        Anyone can re-hash the report and prove it was not edited after publication.
      </P>
    </>
  );
}
