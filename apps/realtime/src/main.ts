import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createLogger } from '@riskrail/logger';
import { createRedisConnection, RealtimeChannel, type RealtimeEvent } from '@riskrail/queue';

const log = createLogger('riskrail-realtime');
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404); res.end();
});

const allowedOrigins = (process.env.WEB_URL ?? 'http://localhost:3000')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
});

io.on('connection', (socket) => {
  socket.on('portfolio:subscribe', (address: string) => {
    if (typeof address === 'string' && address.length < 80) socket.join(`portfolio:${address}`);
  });
  socket.on('portfolio:unsubscribe', (address: string) => {
    if (typeof address === 'string' && address.length < 80) socket.leave(`portfolio:${address}`);
  });
});

const subscriber = createRedisConnection();
await subscriber.subscribe(RealtimeChannel);
subscriber.on('message', (channel, payload) => {
  if (channel !== RealtimeChannel) return;
  try {
    const message = JSON.parse(payload) as RealtimeEvent;
    if (!message.address || !message.event) return;
    io.to(`portfolio:${message.address}`).emit('riskrail:event', message);
  } catch (error) {
    log.warn({ error }, 'ignored invalid realtime message');
  }
});

const port = Number(process.env.REALTIME_PORT ?? 4001);
httpServer.listen(port, '0.0.0.0', () => log.info({ port, channel: RealtimeChannel }, 'realtime gateway online'));

async function shutdown() {
  await subscriber.quit();
  io.close();
  httpServer.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
