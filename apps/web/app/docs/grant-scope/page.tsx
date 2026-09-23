import { A, C, Callout, DocHeader, H2, H3, P, Table, UL } from "@/components/docs/prose";

export const metadata = { title: "Grant scope" };

const TODAY = <strong className="text-healthy">Today</strong>;

export default function GrantScope() {
  return (
    <>
      <DocHeader
        eyebrow="Operate"
        title="Grant scope"
        lede="What Rivisk already has, and what the Stacks Endowment grant would fund from here. The two are kept apart deliberately: nothing already built is being asked for again."
      />

      <Callout type="note" title="Baseline as of 23 September 2026">
        Rivisk already has a hosted beta, deployed testnet contracts, live attestations with
        Chainhook confirmation, a published SDK, wallet authentication, API keys, signed webhooks,
        realtime updates and a Zest V2 adapter validated against a real mainnet obligation. Those
        are existing project assets, evidenced on <A href="/docs/status">Project status</A>, and are
        not grant deliverables.
      </Callout>

      <H2 id="table">Today, and what comes next</H2>
      <Table
        head={["Area", "Today", "Grant work"]}
        rows={[
          ["Clarity contracts", <>{TODAY}: deployed on testnet, read by an external consumer</>, "Independent security and readiness review"],
          ["Attestations", <>{TODAY}: live, throttled, confirmed back by Chainhook</>, "Reliability work: retries, nonce handling, publisher key management, monitoring"],
          ["TypeScript SDK", <>{TODAY}: published as {<C key="c">@rivisk/sdk@0.1.1</C>}</>, "Iterate on feedback from external developers; versioning and release discipline"],
          ["Hosted API", <>{TODAY}: beta on one small server, on temporary AWS credits</>, "Architecture review, then sustainable paid hosting: persistent database with tested backups and restores, monitoring, recovery, rate-limit and abuse handling"],
          ["Liquidity", <>{TODAY}: capital accessibility, labelled as a proxy</>, "Real market-depth and exit-risk modelling"],
          ["Risk explanations", "Not built", "Optional AI layer that explains an existing report in plain language"],
          ["External integration", <>{TODAY}: reference consumer contract only</>, "One real external Stacks project integrating against the API or the trait"],
          ["Mainnet", "Not deployed", "Review the current contracts, make any changes they call for, redeploy and revalidate on testnet if the code changes, then deploy the reviewed contracts to mainnet if no blocking finding remains"],
        ]}
      />

      <P>
        The contracts on testnet today are a working beta deployment, not a claim that the design
        is final. Reviewing that design is part of the grant. If the review calls for changes, a
        revised version is deployed and validated on testnet before any mainnet release — a Clarity
        contract cannot be edited in place, so a change means a new deployment.
      </P>

      <Callout type="warning" title="Beta infrastructure">
        Rivisk is publicly usable today, but the backend runs on an early-stage AWS deployment
        currently covered by temporary promotional credits, with no production SLA. Those credits
        expire. Reviewing the architecture and moving to sustainable, paid hosting is part of the
        proposed grant work, which is why infrastructure appears in the budget below.
      </Callout>

      <H2 id="milestones">Milestones</H2>
      <Table
        head={["Milestone", "Focus", "Amount", "Target"]}
        rows={[
          ["1", "Beta hardening and infrastructure review", "$2,000", "14 Oct 2026"],
          ["2", "Advanced risk intelligence and AI explanations", "$3,000", "11 Nov 2026"],
          ["3", "Ecosystem integration and production readiness", "$5,000", "2 Dec 2026"],
        ]}
      />
      <H3 id="budget">Budget</H3>
      <Table
        head={["Milestone", "Engineering", "Infrastructure and external costs", "Total"]}
        rows={[
          ["1", "$1,100 architecture and hardening", "$600 hosting · $300 monitoring and backups", "$2,000"],
          ["2", "$2,300 risk depth and AI implementation", "$200 model usage · $500 market data and testing", "$3,000"],
          ["3", "$2,200 integration and release work", "$1,200 independent review · $1,100 production infrastructure · $500 validation and docs", "$5,000"],
        ]}
      />
      <P>
        Infrastructure is listed openly because the current hosting is credit-funded and those
        credits run out; the grant pays for hosting that does not depend on them.
      </P>

      <P>
        The full breakdown, with acceptance criteria per milestone, is in{" "}
        <A href="https://github.com/TheSoftNode/rivisk/blob/main/documentation/22-grant-milestones.md">
          22-grant-milestones.md
        </A>
        .
      </P>

      <H2 id="ai">The AI explainer</H2>
      <P>
        Rivisk already produces technically correct risk data. Health factor, liquidation distance,
        concentration, valuation coverage and stress results are still hard for most people to read
        together, which is the gap this closes.
      </P>
      <H3 id="ai-boundary">Where it sits</H3>
      <P>
        The AI never computes risk. It reads a finished, deterministic report and explains it:
      </P>
      <Table
        head={["", ""]}
        rows={[
          [<strong key="n">Never</strong>, <C key="a">protocol data → AI → risk score</C>],
          [<strong key="y">Always</strong>, <C key="b">protocol data → adapters → risk engine → report → AI → explanation</C>],
        ]}
      />
      <P>
        Every number stays reproducible from the report hash, with or without the explainer, and
        nothing about attestations changes: no model output is ever hashed or published on chain.
      </P>
      <H3 id="ai-cost">Keeping the cost bounded</H3>
      <UL>
        <li>No model call during indexing, scoring, pricing or attestation.</li>
        <li>A call happens only when someone asks for an explanation.</li>
        <li>
          Answers are cached by <C>reportHash</C> plus question type, so the same report is never
          explained twice.
        </li>
        <li>A small, low-cost model by default, and the provider is replaceable.</li>
        <li>
          The core API keeps working with the explainer disabled, which is how the beta runs today.
        </li>
      </UL>
      <P>
        Cost therefore scales with how often people ask, not with how many wallets are indexed. The
        milestone carries an explicit line for model evaluation and beta usage rather than hiding
        it.
      </P>
    </>
  );
}
