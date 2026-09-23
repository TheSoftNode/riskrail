# @rivisk/sdk

Typed client for the [Rivisk](https://github.com/TheSoftNode/rivisk) risk intelligence API — cross-protocol portfolio risk for Bitcoin capital on Stacks.

Zero runtime dependencies. Works in Node 18+, browsers, Deno, Bun, Cloudflare Workers and Vercel Edge.

```bash
npm install @rivisk/sdk
```

ESM only, Node 18 or newer.

> A hosted **beta** API is live at `https://api.13.49.129.179.sslip.io/api/v1`
> and powers the Rivisk dashboard. It runs on deliberately small, low-cost
> infrastructure: fine for trying the SDK, but it carries no availability
> guarantee, so point `baseUrl` at your own instance for anything that matters
> ([self-hosting](https://github.com/TheSoftNode/rivisk#readme)). The Clarity
> contracts are live on Stacks testnet and can be read today.

## Quick start

```ts
import { RiviskClient } from '@rivisk/sdk';

const rivisk = new RiviskClient({
  baseUrl: process.env.RIVISK_API_URL, // e.g. http://localhost:4000/api/v1
  apiKey: process.env.RIVISK_API_KEY,  // optional for public reads
});

const risk = await rivisk.portfolios.risk('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7');

console.log(risk.riskLevel);        // 'moderate'
console.log(risk.healthFactorE4);   // 14700  -> 1.47
console.log(risk.sourceBlock);      // '184233'
```

Reads scoped to a public Stacks address need **no credential**.

| Credential | Works for |
| --- | --- |
| none | portfolios, risk, simulations, policies, alert lists |
| API key (`rv_live_…` / `rv_test_…`) | the above, plus creating and changing alerts and webhooks |
| wallet session | everything, including API keys and the account profile |

API keys deliberately cannot manage keys or change the profile, so a leaked key cannot mint more keys or redirect notification email.

## Units

The API sends integers so nothing is lost to floating point. Three conventions, and helpers so you never have to remember them:

| Field | Meaning | Helper |
| --- | --- | --- |
| `*Bps` | basis points, 10000 = 100% | `fromBps(4400) // 0.44` · `bpsToPercent(4400) // 44` |
| `healthFactorE4` | scaled by 10000, `14700` = 1.47 | `fromE4(14700) // 1.47` |
| money | decimal **strings**, never numbers | parse with your own decimal library |

```ts
import { fromE4, bpsToPercent } from '@rivisk/sdk';

`Health factor ${fromE4(risk.healthFactorE4!).toFixed(2)}`;
`Largest protocol ${bpsToPercent(risk.protocolConcentrationBps!)}%`;
```

> A wallet with **no debt** has no meaningful health factor. On-chain it is published as the maximum uint, not zero — see [Consuming Rivisk on-chain](https://github.com/TheSoftNode/rivisk/blob/main/documentation/35-consuming-rivisk-onchain.md). Over the API, `healthFactorE4` is `null` in that case. Either way, treat "absent" as *safe*, not as *about to liquidate*.

## Recipes

### Show risk before routing a user into a position

```ts
const risk = await rivisk.portfolios.risk(address);

if (risk.status === 'not-indexed') {
  await rivisk.portfolios.refresh(address); // queues an index; returns immediately
}

if (risk.riskLevel === 'critical' || risk.riskLevel === 'elevated') {
  return { allow: false, reason: `Risk is ${risk.riskLevel}` };
}
```

### Stress test before allowing more leverage

```ts
const result = await rivisk.simulations.run(address, {
  name: 'BTC -20%',
  shocks: [{ symbol: 'sBTC', changeBps: -2000 }],
});

const liquidated = result.positions.filter((p) => !p.liquidatableBefore && p.liquidatableAfter);
if (liquidated.length > 0) {
  return { allow: false, reason: 'A 20% BTC drawdown liquidates this position' };
}
```

`simulations.run` writes nothing, so it is safe to call as often as you like — the client treats it as idempotent and will retry it through a transient failure.

### Sign in with a Stacks wallet

The SDK never touches a private key. Your app does the signing; the SDK handles the rest.

```ts
import { request } from '@stacks/connect';

const { message } = await rivisk.auth.challenge(address);
const { signature, publicKey } = await request('stx_signMessage', { message });

await rivisk.auth.verify({ address, signature, publicKey });
// The client now holds the session and refreshes its own access token.

await rivisk.alerts.create(address, {
  metric: 'healthFactorE4',
  operator: 'lt',
  threshold: '13000', // fires below 1.30
});
```

Persist the session across reloads:

```ts
const rivisk = new RiviskClient({
  baseUrl,
  session: JSON.parse(localStorage.getItem('rivisk_session') ?? 'null'),
  onSession: (session) => {
    if (session) localStorage.setItem('rivisk_session', JSON.stringify(session));
    else localStorage.removeItem('rivisk_session');
  },
});
```

`onSession` fires on sign-in, on every token refresh, and with `null` when the refresh token dies — so storage never holds a session the server has already rejected.

### Receive webhooks

```ts
import { constructWebhookEvent, SIGNATURE_HEADER } from '@rivisk/sdk';

export async function POST(req: Request) {
  const raw = await req.text();          // the RAW body, before any parsing

  let event;
  try {
    event = await constructWebhookEvent(
      raw,
      req.headers.get(SIGNATURE_HEADER),
      process.env.RIVISK_WEBHOOK_SECRET!,
    );
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  switch (event.type) {
    case 'risk.updated':      /* ... */ break;
    case 'alert.triggered':   /* ... */ break;
    case 'policy.breached':   /* ... */ break;
    case 'portfolio.updated': /* ... */ break;
  }

  return new Response('ok');            // 2xx stops the retry schedule
}
```

Three things that bite everyone once:

- **Use the raw body.** Parsing and re-stringifying changes key order and whitespace, and the signature will not match. There is a test in this package for exactly that mistake.
- **The timestamp is signed.** An old body cannot be replayed under a fresh `t`. Deliveries older than 300s are rejected by default; change it with `toleranceSeconds`.
- **Non-2xx means retry.** The sender backs off over 30s, 2m, 10m, 1h, then drops the delivery.

### Subscribe to live events

Needs the optional peer `socket.io-client`.

```bash
npm install socket.io-client
```

```ts
const rivisk = new RiviskClient({ baseUrl, realtimeUrl: process.env.RIVISK_REALTIME_URL });

const unsubscribe = await rivisk.realtime.subscribe(address, (message) => {
  if (message.event === 'risk.updated') refreshUi(message.data);
});

// later
unsubscribe();
rivisk.close();
```

Subscriptions are re-sent automatically after a reconnect — rooms live on the server and do not survive a dropped socket, which would otherwise silently stop delivery while the client still looked healthy.

## Reliability

The transport handles this so no endpoint has to:

- **Timeouts** — 30s per attempt, `timeoutMs` to change.
- **Retries** — exponential backoff with full jitter, so a fleet recovering from one outage does not synchronise into the next.
- **`Retry-After`** — honoured over the SDK's own backoff.
- **Cancellation** — pass an `AbortSignal` to any call.

What gets retried is deliberately conservative:

| Case | Retried? |
| --- | --- |
| `GET` on 5xx, 408, or network failure | yes |
| **any** method on 429 | yes — a rate-limited request was never processed |
| `POST`/`PATCH`/`DELETE` on 5xx | **no** — the server may have acted before failing |
| Any 4xx other than 408/429 | no |

Opt a specific call in with `{ idempotent: true }` when you know it is safe.

```ts
const rivisk = new RiviskClient({
  baseUrl,
  timeoutMs: 10_000,
  retry: { maxRetries: 5, baseDelayMs: 200, maxDelayMs: 10_000 },
  onRetry: ({ attempt, delayMs, error }) =>
    logger.warn({ attempt, delayMs, status: error.status }, 'retrying'),
});

// or turn it off entirely and drive your own queue
const plain = new RiviskClient({ baseUrl, retry: false });
```

## Errors

Everything thrown is a `RiviskError`, so one catch is enough — and the subclasses are there when you want to branch.

```ts
import {
  RiviskError,
  RiviskAuthError,
  RiviskRateLimitError,
  RiviskNetworkError,
  RiviskTimeoutError,
} from '@rivisk/sdk';

try {
  await rivisk.portfolios.risk(address);
} catch (error) {
  if (error instanceof RiviskRateLimitError) {
    await sleep((error.retryAfterSeconds ?? 60) * 1000);
  } else if (error instanceof RiviskAuthError) {
    redirectToSignIn();
  } else if (error instanceof RiviskError) {
    logger.error({ status: error.status, body: error.body, requestId: error.requestId });
  }
}
```

`error.retryable` is the same judgement the client uses internally, exposed for callers running their own queues.

## API surface

| Namespace | Methods |
| --- | --- |
| `auth` | `challenge` `verify` `refresh` `signOut` `me` `updateProfile` |
| `portfolios` | `get` `risk` `refresh` |
| `simulations` | `presets` `run` |
| `alerts` | `list` `create` `setStatus` `pause` `resume` `archive` |
| `policies` | `get` |
| `webhooks` | `list` `create` `setEnabled` `remove` |
| `apiKeys` | `list` `create` `revoke` |
| `realtime` | `subscribe` `close` |
| top level | `health` `ready` `getSession` `setSession` `close` |

Every method takes an optional trailing `RequestOptions` for `signal`, `headers`, `query` and `idempotent`.

## Reading risk from a Clarity contract

If the consumer is itself a smart contract, it does not need this SDK — it reads the attested subset directly from `risk-registry.clar` through `risk-provider-trait`:

```clarity
(contract-call? .risk-registry get-risk-if-fresh user u144)
```

That returns `none` rather than a stale reading, so the freshness check cannot be skipped. `u144` is a *block* count: at testnet's measured ~9.6s per block it is about 23 minutes, not a day. Choose the bound from how stale a reading your product can tolerate. See [Consuming Rivisk on-chain](https://github.com/TheSoftNode/rivisk/blob/main/documentation/35-consuming-rivisk-onchain.md).

## Status

The SDK is implemented and unit-tested against the API's real response shapes. It has **not** yet been exercised against a deployed Rivisk instance — see [current status](https://github.com/TheSoftNode/rivisk/blob/main/documentation/29-current-status.md) for what is proven and what is not.

## License

MIT
