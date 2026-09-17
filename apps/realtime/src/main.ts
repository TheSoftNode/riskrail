import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createLogger } from '@riskrail/logger';

const log = createLogger('riskrail-realtime');
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404); res.end();
});

const io = new Server(httpServer, {
  cors: { origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true },
});

io.on('connection', (socket) => {
  socket.on('portfolio:subscribe', (address: string) => {
    if (typeof address === 'string' && address.length < 80) socket.join(`portfolio:${address}`);
  });
});

const port = Number(process.env.REALTIME_PORT ?? 4001);
httpServer.listen(port, '0.0.0.0', () => log.info({ port }, 'realtime gateway online'));
