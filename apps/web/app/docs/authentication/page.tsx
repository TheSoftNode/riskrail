import { A, C, Callout, DocHeader, H2, H3, P, Step, Steps, Table } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Authentication" };

export default function Authentication() {
  return (
    <>
      <DocHeader
        eyebrow="Integrate"
        title="Authentication"
        lede="Public reads need nothing. Account-scoped actions take an API key for server-to-server calls, or a wallet-signature session when a person is signing in."
      />

      <H2 id="matrix">What each credential can do</H2>
      <Table
        head={["Credential", "Portfolios, risk, simulations, policies, alert lists", "Create and change alerts and webhooks", "API keys and profile"]}
        rows={[
          ["None", "✓", "—", "—"],
          [<>API key <C key="k">rv_live_…</C> / <C key="t">rv_test_…</C></>, "✓", "✓", "—"],
          ["Wallet session", "✓", "✓", "✓"],
        ]}
      />
      <P>
        Both credentials are sent the same way, as a bearer token:
      </P>
      <CodeBlock lang="http" code={`Authorization: Bearer rv_live_3f9a…`} />
      <Callout type="note" title="Why a key cannot manage keys">
        An API key lives on a server and is the credential most likely to leak. Key management and
        the profile (which controls where alert emails go) therefore require a wallet session, so a
        leaked key cannot mint more keys or redirect your notifications.
      </Callout>

      <H2 id="ownership">Ownership</H2>
      <P>
        Alerts belong to an address, and writing one requires that the credential&apos;s account{" "}
        <strong>controls</strong> that address, meaning it has signed in with it. A wallet row
        existing because someone scanned the address proves nothing, so an unclaimed address
        cannot be claimed through the alerts API. Writing to an address you do not control returns{" "}
        <C>403</C>.
      </P>

      <H2 id="sessions">Wallet sessions</H2>
      <P>
        Rivisk never sees a private key. The wallet signs a one-time challenge and the API checks
        that the signature came from the public key that hashes to the claimed address.
      </P>
      <Steps>
        <Step title="Request a challenge">
          <CodeBlock
            code={`const { message } = await rivisk.auth.challenge(address);`}
          />
          <P>
            The message expires after <strong>300 seconds</strong> and authenticates exactly one
            sign-in; it is deleted the moment it is used.
          </P>
        </Step>
        <Step title="Sign it in the wallet">
          <CodeBlock
            code={`
import { request } from '@stacks/connect';

const { signature, publicKey } = await request('stx_signMessage', { message });
`}
          />
          <P>
            It is a message signature, not a transaction: it moves no funds and costs nothing.
          </P>
        </Step>
        <Step title="Exchange it for tokens">
          <CodeBlock
            code={`
const session = await rivisk.auth.verify({ address, publicKey, signature });
// { userId, address, accessToken, refreshToken, expiresIn }
`}
          />
          <P>
            From here the SDK holds the session and refreshes it on its own: a <C>401</C> triggers
            one refresh and the original request is replayed with the new token.
          </P>
        </Step>
      </Steps>

      <H3 id="lifetimes">Token lifetimes</H3>
      <Table
        head={["Token", "Lifetime", "Notes"]}
        rows={[
          ["Challenge", "300 seconds", "Single use"],
          ["Access token", "15 minutes", "Sent as the bearer token"],
          ["Refresh token", "30 days", <>Only accepted by <C key="r">POST /auth/refresh</C>; rejected as an access token</>],
        ]}
      />

      <H3 id="persist">Persisting a session</H3>
      <CodeBlock
        code={`
const rivisk = new RiviskClient({
  baseUrl,
  session: JSON.parse(localStorage.getItem('rivisk_session') ?? 'null'),
  onSession: (session) => {
    if (session) localStorage.setItem('rivisk_session', JSON.stringify(session));
    else localStorage.removeItem('rivisk_session');
  },
});
`}
      />
      <P>
        <C>onSession</C> fires on sign-in, on every refresh, and with <C>null</C> when the refresh
        token is rejected, so storage never holds a session the server has already refused.
      </P>

      <H2 id="api-keys">API keys</H2>
      <P>
        Create keys from a wallet session, either on the Developers page of the dashboard or over
        the API:
      </P>
      <CodeBlock
        code={`
const key = await rivisk.apiKeys.create('production backend', true);  // live: true
key.token;   // rv_live_… shown once, never again. Store it now.
`}
      />
      <Table
        head={["Prefix", "Use"]}
        rows={[
          [<C key="l">rv_live_</C>, "Production"],
          [<C key="t">rv_test_</C>, "Development and CI"],
        ]}
      />
      <P>
        Keys are stored only as a peppered SHA-256 hash and compared in constant time, so a
        database leak does not hand out working credentials. The first 16 characters are kept in
        clear so you can tell your keys apart in the dashboard. Revoke with{" "}
        <C>rivisk.apiKeys.revoke(id)</C>; it takes effect on the next request.
      </P>
      <CodeBlock
        code={`
const server = new RiviskClient({ baseUrl, apiKey: process.env.RIVISK_API_KEY });
await server.webhooks.create('https://example.com/rivisk', ['alert.triggered']);
`}
      />

      <P>
        Endpoint by endpoint, the credential each one takes is listed on{" "}
        <A href="/docs/api">REST API</A>.
      </P>
    </>
  );
}
