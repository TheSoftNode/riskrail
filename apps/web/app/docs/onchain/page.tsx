import { A, C, Callout, DocHeader, H2, H3, P, Table, UL } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Consuming on-chain" };

export default function Onchain() {
  return (
    <>
      <DocHeader
        eyebrow="On-chain"
        title="Consuming Rivisk on-chain"
        lede="How another Clarity contract reads a wallet's risk and acts on it. The two rules at the top of this page matter more than everything below them."
      />

      <H2 id="rules">Two rules</H2>
      <H3 id="rule-freshness">1. A reading has an age</H3>
      <P>
        <C>get-latest-risk</C> will return a snapshot published hours ago, describing chain state
        older still. Acting on it is how a protocol liquidates someone on stale data. Use{" "}
        <C>get-risk-if-fresh</C>, which returns <C>none</C> instead of a stale reading. The check
        cannot be forgotten, because there is no way to get the value without passing the bound.
      </P>
      <H3 id="rule-sentinel">2. A debt-free wallet publishes the safest values, not zero</H3>
      <P>
        With no debt, <C>health-factor-e4</C> is the maximum uint and{" "}
        <C>liquidation-distance-bps</C> is <C>u10000</C>. So the natural check{" "}
        <C>(&gt;= health-factor u12500)</C> treats that wallet as safe. Had zero been published,
        the same check would reject it as the riskiest position on the chain.
      </P>

      <H2 id="pattern">The integration pattern</H2>
      <CodeBlock
        lang="clarity"
        title="your-contract.clar"
        code={`
(use-trait risk-provider 'ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7.risk-provider-trait.risk-provider-trait)

(define-constant ERR_NO_FRESH_RISK (err u1))
(define-constant ERR_UNHEALTHY (err u2))

(define-public (borrow-more (provider <risk-provider>) (amount uint))
  (let (
    (risk (unwrap!
            (try! (contract-call? provider get-risk-if-fresh tx-sender u375))  ;; ~1 hour
            ERR_NO_FRESH_RISK))
  )
    (asserts! (>= (get health-factor-e4 risk) u15000) ERR_UNHEALTHY)       ;; 1.50
    ;; ... your logic. Keep (get report-hash risk) to make the decision auditable.
    (ok true)
  )
)
`}
      />
      <UL>
        <li>
          <strong>Take the provider as an argument</strong> (<C>{"<risk-provider>"}</C>) rather than
          hardcoding the registry. The same code then works against a test double in your own
          suite, a future registry version, or any conforming provider, and your tests do not
          need Rivisk deployed.
        </li>
        <li>
          Callers pass <C>&apos;ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7.risk-registry</C> as the
          provider on testnet.
        </li>
        <li>
          <strong>Record the report hash</strong> with the decision. It ties the decision to the
          exact report it was made from.
        </li>
      </UL>

      <H2 id="freshness">Choosing a freshness bound</H2>
      <P>
        Freshness is counted in <strong>Stacks blocks</strong>, which arrive every few seconds, not
        every ten minutes. On testnet on 2026-09-21 we measured <strong>9.6 seconds per block</strong>:
      </P>
      <Table
        head={["Window", "Blocks at ~9.6 s"]}
        rows={[
          ["5 minutes", "~31"],
          ["1 hour", "~375"],
          ["1 day", "~9,000"],
        ]}
      />
      <Callout type="warning" title="144 blocks is not a day">
        <p>
          <C>u144</C> is about <strong>23 minutes</strong>. The reference consumer uses it, and its
          source comment calls it &ldquo;roughly a day&rdquo;, a leftover from pre-Nakamoto block times.
          Pick the bound from how stale a reading your product can tolerate, convert it, and
          re-measure block time on the network you target.
        </p>
      </Callout>
      <P>
        A snapshot is only refreshed when its wallet is re-indexed. A tight window therefore needs
        frequent indexing (a scheduled refresh, or Chainhook triggers) to stay satisfiable. Too
        tight a bound and your contract refuses everyone.
      </P>

      <H2 id="read-only">The read-only limitation</H2>
      <P>
        Clarity will not let a <C>define-read-only</C> function dispatch on a trait. The analyzer
        cannot prove a dynamically resolved callee is read-only, so it treats the whole function as
        writing. You will hit this as soon as you try to build a &ldquo;would this be allowed?&rdquo;
        preview.
      </P>
      <P>
        Split the two halves. <C>get-risk-if-fresh</C> on the registry is itself read-only, so a UI
        or your own read-only function can call the registry directly and apply thresholds with a
        pure helper:
      </P>
      <CodeBlock
        lang="clarity"
        code={`
(define-read-only (meets-policy (health-factor-e4 uint) (concentration-bps uint))
  (and (>= health-factor-e4 u15000)
       (<= concentration-bps u6000)))
`}
      />

      <H2 id="verify">Verifying a report</H2>
      <P>
        Fetch the report from the API, canonicalise it (sort object keys recursively), serialise
        it as JSON, SHA-256 it, and compare with <C>report-hash</C>. A match proves the report is
        the one that was attested and has not been edited since.
      </P>

      <H2 id="trust">What the registry does not tell you</H2>
      <UL>
        <li>
          <strong>That the numbers are right.</strong> It attests what Rivisk computed and that it
          has not changed since. The trust model is &ldquo;an authorised publisher said this at this
          block&rdquo;, not &ldquo;this is objectively true&rdquo;.
        </li>
        <li>
          <strong>That a protocol endorses Rivisk.</strong> <C>protocol-registry</C> records adapter
          support, nothing more.
        </li>
        <li>
          <strong>Exact parity with a protocol&apos;s oracle.</strong> Rivisk marks to its own price
          source, so its liquidation distances differ from a protocol&apos;s own by the spread
          between the two.
        </li>
      </UL>

      <P>
        Every function and error code is on <A href="/docs/contracts">Smart contracts</A>.
      </P>
    </>
  );
}
