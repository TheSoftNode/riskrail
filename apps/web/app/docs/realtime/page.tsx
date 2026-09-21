import { C, Callout, DocHeader, H2, P, Table } from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata = { title: "Realtime" };

export default function Realtime() {
  return (
    <>
      <DocHeader
        eyebrow="Integrate"
        title="Realtime"
        lede="Live portfolio and risk events for an address, pushed over Socket.IO the moment a snapshot lands. Use it for interfaces; use webhooks for servers."
      />

      <H2 id="sdk">With the SDK</H2>
      <P>
        Realtime needs the optional peer <C>socket.io-client</C>. Without it the SDK throws a clear
        error rather than failing somewhere obscure.
      </P>
      <CodeBlock lang="bash" code={`npm install @rivisk/sdk socket.io-client`} />
      <CodeBlock
        code={`
const rivisk = new RiviskClient({ baseUrl, realtimeUrl: 'http://localhost:4001' });

const unsubscribe = await rivisk.realtime.subscribe(address, (message) => {
  if (message.event === 'risk.updated') render(message.data);
});

// later
unsubscribe();
rivisk.close();
`}
      />
      <P>
        One socket carries every subscription. The SDK re-sends them after a reconnect: rooms live
        on the server and do not survive a dropped connection, and without that a monitor would
        silently stop receiving events while still looking connected.
      </P>

      <H2 id="messages">Messages</H2>
      <CodeBlock
        lang="json"
        code={`
{
  "event": "risk.updated",
  "address": "SP10GK6MG2GM7BCVYV7XBHK1JVJDHFDMNBENNBRC3",
  "data": { "riskLevel": "critical", "riskScoreBps": 9979, "healthFactorE4": 11798, "reportHash": "…" },
  "timestamp": "2026-09-21T12:00:00.000Z"
}
`}
      />
      <P>
        The four event names and their <C>data</C> are the same as for webhooks. Every event goes to
        both, through one code path, so the two cannot drift.
      </P>

      <H2 id="protocol">Wire protocol</H2>
      <P>For clients that do not use the SDK:</P>
      <Table
        head={["Direction", "Event", "Payload"]}
        rows={[
          ["client → server", <C key="1">portfolio:subscribe</C>, "The address, as a string"],
          ["client → server", <C key="2">portfolio:unsubscribe</C>, "The address, as a string"],
          ["server → client", <C key="3">rivisk:event</C>, "The message above"],
        ]}
      />
      <CodeBlock
        code={`
import { io } from 'socket.io-client';

const socket = io('http://localhost:4001', { transports: ['websocket'] });
socket.on('connect', () => socket.emit('portfolio:subscribe', address));  // re-subscribe on every connect
socket.on('rivisk:event', (message) => console.log(message));
`}
      />

      <Callout type="note" title="Access">
        Subscriptions are by public address and need no credential, the same as the public read
        endpoints. The service only accepts browser connections from the origins listed in{" "}
        <C>WEB_URL</C> (comma-separated). It listens on <C>REALTIME_PORT</C>, default 4001.
      </Callout>
    </>
  );
}
