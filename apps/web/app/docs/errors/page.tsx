import { A, C, Callout, DocHeader, H2, P, Table } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Errors and limits" };

export default function Errors() {
  return (
    <>
      <DocHeader
        eyebrow="Operate"
        title="Errors and limits"
        lede="What an error looks like, what each status means, where the limits are, and which requests are safe to repeat."
      />

      <H2 id="shape">Error body</H2>
      <CodeBlock
        lang="json"
        code={`
{
  "statusCode": 400,
  "message": ["address must be a Stacks principal"],
  "error": "Bad Request"
}
`}
      />
      <P>
        <C>message</C> is a string, or an array of strings when several validation rules failed.
        The SDK joins the array into a single message on <C>RiviskError</C> and keeps the original
        body on <C>error.body</C>.
      </P>

      <H2 id="statuses">Status codes</H2>
      <Table
        head={["Status", "Meaning", "Typical cause", "Retry?"]}
        rows={[
          [<C key="1">400</C>, "Invalid request", "A malformed address (checked including its checksum), a threshold that is not a decimal string, an unknown webhook event", "No"],
          [<C key="2">401</C>, "No valid credential", "Missing, expired or revoked token or key; a refresh token used as an access token", "Once, after refreshing"],
          [<C key="3">403</C>, "Not yours", "Writing an alert for an address your account does not control", "No"],
          [<C key="4">404</C>, "Not found", <>Risk for a wallet that has not been indexed: call <C key="r">refresh</C> first</>, "After indexing"],
          [<C key="5">409</C>, "Conflict", "An email address already linked to another account", "No"],
          [<C key="6">429</C>, "Rate limited", <>Honour <C key="h">Retry-After</C></>, "Yes"],
          [<C key="7">5xx</C>, "Server error", "An outage or a bug", "GET only"],
        ]}
      />

      <H2 id="rate-limits">Rate limits</H2>
      <Table
        head={["Endpoint", "Limit"]}
        rows={[
          [<C key="1">POST /portfolios/:address/refresh</C>, "10 per minute, per client IP"],
        ]}
      />
      <P>
        It is the only rate-limited route, because it is the only public one that queues real
        work against the Stacks API. Over the limit, the response is <C>429</C> with a{" "}
        <C>Retry-After</C> header in seconds. The SDK waits for it automatically.
      </P>
      <CodeBlock
        lang="http"
        code={`
HTTP/1.1 429 Too Many Requests
Retry-After: 25

{ "statusCode": 429, "message": "Too many requests. Please retry shortly.", "retryAfter": 25 }
`}
      />
      <Callout type="note" title="Self-hosting behind a proxy">
        Limits key on client IP. Behind a load balancer, set <C>TRUST_PROXY_HOPS</C> to the number
        of proxies, or every caller shares one bucket. Set it too high and callers can spoof{" "}
        <C>X-Forwarded-For</C> to get a fresh bucket. If Redis is unreachable the limiter fails
        open, so a Redis outage does not take down public reads.
      </Callout>

      <H2 id="retries">What is safe to retry</H2>
      <Table
        head={["Request", "On 5xx or network failure"]}
        rows={[
          [<C key="1">GET</C>, "Safe. Reads have no side effects"],
          [<C key="2">POST /simulations</C>, "Safe. It writes nothing"],
          [<C key="3">POST /portfolios/:address/refresh</C>, "Safe. A duplicate refresh is just another index"],
          ["Creating keys, webhooks or alerts", "Not safe. The server may have created it before failing; list first"],
          ["Anything on 429", "Safe. It was never processed"],
        ]}
      />
      <P>
        The SDK follows exactly this table. See <A href="/docs/sdk#reliability">SDK retries</A>.
      </P>

      <H2 id="onchain">Contract errors</H2>
      <P>
        Clarity calls fail with <C>(err uNNN)</C>. The full list is on{" "}
        <A href="/docs/contracts#errors">Smart contracts</A>.
      </P>
    </>
  );
}
