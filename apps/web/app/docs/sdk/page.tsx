import { A, C, Callout, DocHeader, Fields, H2, H3, P, Table } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "TypeScript SDK" };

export default function Sdk() {
  return (
    <>
      <DocHeader
        eyebrow="Integrate"
        title="TypeScript SDK"
        lede="A typed client for the whole API. Timeouts, retries, session refresh and webhook verification are handled for you. Zero runtime dependencies."
      />

      <H2 id="install">Install</H2>
      <CodeBlock lang="bash" code={`npm install @rivisk/sdk`} />
      <Table
        head={["", ""]}
        rows={[
          ["Package", <><A key="n" href="https://www.npmjs.com/package/@rivisk/sdk">@rivisk/sdk</A> on npm</>],
          ["Module format", "ESM only"],
          ["Runtimes", "Node 18+, browsers, Deno, Bun, Cloudflare Workers, Vercel Edge"],
          ["Dependencies", <>None. <C key="s">socket.io-client</C> is an optional peer, needed only for realtime</>],
        ]}
      />

      <H2 id="client">Creating a client</H2>
      <CodeBlock
        code={`
import { RiviskClient } from '@rivisk/sdk';

const rivisk = new RiviskClient({
  baseUrl: 'http://localhost:4000/api/v1',
  apiKey: process.env.RIVISK_API_KEY,
});
`}
      />
      <H3 id="options">Options</H3>
      <Fields
        fields={[
          { name: "baseUrl", type: "string", children: <>API origin including <C>/api/v1</C>. Defaults to <C>http://localhost:4000/api/v1</C>.</> },
          { name: "apiKey", type: "string", children: <>An <C>rv_live_</C> / <C>rv_test_</C> key. A wallet session takes precedence when both are present.</> },
          { name: "session", type: "AuthSession | null", children: "Restore a session from storage so the client starts signed in." },
          { name: "onSession", type: "(session) => void", children: <>Called on sign-in, every refresh, and with <C>null</C> when the session ends.</> },
          { name: "timeoutMs", type: "number", children: "Per attempt. Default 30000." },
          { name: "retry", type: "Partial<RetryPolicy> | false", children: <>Default <C>{`{ maxRetries: 3, baseDelayMs: 300, maxDelayMs: 8000 }`}</C>. <C>false</C> disables retrying.</> },
          { name: "onRetry", type: "(info) => void", children: "Observe each retry: attempt, delay, error, method, path." },
          { name: "headers", type: "Record<string, string>", children: "Extra headers on every request." },
          { name: "fetch", type: "typeof fetch", children: "A custom fetch, for tests or unusual runtimes." },
          { name: "realtimeUrl", type: "string", children: <>Realtime service origin. Only needed for <C>rivisk.realtime</C>.</> },
        ]}
      />

      <H2 id="namespaces">Namespaces</H2>
      <Table
        head={["Namespace", "Methods", "Credential"]}
        rows={[
          [<C key="1">portfolios</C>, "get · risk · refresh", "none"],
          [<C key="2">simulations</C>, "presets · run", "none"],
          [<C key="3">policies</C>, "get", "none"],
          [<C key="4">alerts</C>, "list · create · setStatus · pause · resume · archive", "list: none; writes: key or session"],
          [<C key="5">webhooks</C>, "list · create · setEnabled · remove", "key or session"],
          [<C key="6">apiKeys</C>, "list · create · revoke", "session"],
          [<C key="7">auth</C>, "challenge · verify · refresh · signOut · me · updateProfile", "me/updateProfile: session"],
          [<C key="8">realtime</C>, "subscribe · close", "none"],
          ["top level", "health · ready · getSession · setSession · close", ""],
        ]}
      />
      <P>
        Every method takes an optional last argument, <C>RequestOptions</C>:{" "}
        <C>{`{ signal, headers, query, idempotent }`}</C>.
      </P>
      <CodeBlock
        code={`
const controller = new AbortController();
setTimeout(() => controller.abort(), 2000);
await rivisk.portfolios.risk(address, { signal: controller.signal });
`}
      />

      <H2 id="reliability">Retries</H2>
      <P>
        Exponential backoff with full jitter, so a fleet of clients recovering from one outage does
        not synchronise into the next. A server <C>Retry-After</C> header takes precedence over the
        SDK&apos;s own delay. What is retried is deliberately conservative:
      </P>
      <Table
        head={["Case", "Retried"]}
        rows={[
          [<><C key="g">GET</C> on 5xx, 408, network failure or timeout</>, "Yes"],
          ["Any method on 429", "Yes. A rate-limited request was never processed"],
          [<><C key="p">POST</C> / <C key="pa">PATCH</C> / <C key="d">DELETE</C> on 5xx</>, "No. The server may have acted before failing"],
          ["Any other 4xx", "No"],
        ]}
      />
      <P>
        Opt a specific call in with <C>{`{ idempotent: true }`}</C> when you know repeating it is
        safe. <C>simulations.run</C> already does this, since it writes nothing.
      </P>

      <H2 id="errors">Errors</H2>
      <P>
        Everything thrown is a <C>RiviskError</C>, so one <C>catch</C> is enough. Subclasses are
        there when you want to branch:
      </P>
      <Table
        head={["Class", "When", "Useful fields"]}
        rows={[
          [<C key="1">RiviskAuthError</C>, "401 or 403", <C key="a">status</C>],
          [<C key="2">RiviskRateLimitError</C>, "429", <C key="b">retryAfterSeconds</C>],
          [<C key="3">RiviskNetworkError</C>, "No response at all", <><C key="c">status</C> is 0</>],
          [<C key="4">RiviskTimeoutError</C>, "Timed out, or your signal aborted", "—"],
          [<C key="5">RiviskError</C>, "Anything else", <><C key="d">status</C>, <C key="e">body</C>, <C key="f">code</C>, <C key="g">requestId</C></>],
        ]}
      />
      <P>
        <C>error.retryable</C> is the same judgement the client uses internally, exposed for callers
        running their own queues.
      </P>
      <CodeBlock
        code={`
import { RiviskRateLimitError, RiviskAuthError, RiviskError } from '@rivisk/sdk';

try {
  await rivisk.alerts.create(address, { metric: 'healthFactorE4', operator: 'lt', threshold: '13000' });
} catch (error) {
  if (error instanceof RiviskRateLimitError) await sleep((error.retryAfterSeconds ?? 60) * 1000);
  else if (error instanceof RiviskAuthError) redirectToSignIn();
  else if (error instanceof RiviskError) log.error({ status: error.status, body: error.body });
}
`}
      />

      <H2 id="helpers">Helpers and constants</H2>
      <Table
        head={["Export", "Purpose"]}
        rows={[
          [<><C key="1">fromBps</C> · <C key="2">toBps</C> · <C key="3">bpsToPercent</C></>, "Basis-point conversion"],
          [<><C key="4">fromE4</C> · <C key="5">toE4</C></>, "Health-factor conversion"],
          [<C key="6">WEBHOOK_EVENT_TYPES</C>, "The four event names"],
          [<C key="7">ALERT_METRICS</C>, "The seven alert metrics"],
          [<><C key="8">constructWebhookEvent</C> · <C key="9">verifyWebhookSignature</C></>, <A key="w" href="/docs/webhooks">Webhook verification</A>],
          [<><C key="10">SIGNATURE_HEADER</C> and the other header names</>, "So you never type them by hand"],
        ]}
      />
      <Callout type="note">
        Every response type is exported too (<C>RiskResponse</C>, <C>PortfolioResponse</C>,{" "}
        <C>SimulationResponse</C>, <C>WebhookEvent</C> and the rest), so your own code can be typed
        against the same shapes.
      </Callout>
    </>
  );
}
