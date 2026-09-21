import { RiviskError } from './errors.js';
import type { RealtimeMessage } from './types.js';

/**
 * Live portfolio and risk events.
 *
 * `socket.io-client` is an optional peer dependency and is imported lazily, so
 * the SDK stays dependency-free for the majority of integrators who only make
 * HTTP calls. Anyone who wants realtime installs it themselves and gets a clear
 * error if they forget.
 *
 * Wire protocol, as implemented by the realtime service:
 *   emit   `portfolio:subscribe`   <address>
 *   emit   `portfolio:unsubscribe` <address>
 *   listen `rivisk:event`        RealtimeMessage
 */

/** The slice of the socket.io client surface this module uses. */
interface MinimalSocket {
  connected: boolean;
  on(event: string, handler: (...args: unknown[]) => void): unknown;
  off(event: string, handler?: (...args: unknown[]) => void): unknown;
  emit(event: string, ...args: unknown[]): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

type SocketFactory = (url: string, options: Record<string, unknown>) => MinimalSocket;

async function loadSocketIo(): Promise<SocketFactory> {
  try {
    // A variable specifier keeps bundlers and TypeScript from treating an
    // optional peer as a hard requirement.
    const specifier = 'socket.io-client';
    const mod = (await import(specifier)) as { io?: SocketFactory; default?: { io?: SocketFactory } };
    const io = mod.io ?? mod.default?.io;
    if (!io) throw new Error('socket.io-client did not export `io`');
    return io;
  } catch (cause) {
    throw new RiviskError(
      'Realtime needs the optional peer dependency `socket.io-client`. Install it with `npm install socket.io-client`.',
      { status: 0, cause },
    );
  }
}

export interface RealtimeOptions {
  /** Realtime service origin, e.g. https://realtime.rivisk.dev */
  url: string;
  /** Passed through to socket.io, for auth headers or transport pinning. */
  socketOptions?: Record<string, unknown>;
}

export type RealtimeHandler = (message: RealtimeMessage) => void;

/**
 * One socket, many address subscriptions.
 *
 * Subscriptions are tracked so they can be re-sent after a reconnect -- without
 * that, a dropped connection silently stops delivering events while still
 * looking healthy, which is the worst failure mode for a monitoring product.
 */
export class RealtimeClient {
  private socket: MinimalSocket | null = null;
  private connecting: Promise<MinimalSocket> | null = null;
  private readonly handlers = new Map<string, Set<RealtimeHandler>>();

  constructor(private readonly options: RealtimeOptions) {}

  private async socketRef(): Promise<MinimalSocket> {
    if (this.socket) return this.socket;
    this.connecting ??= (async () => {
      const io = await loadSocketIo();
      const socket = io(this.options.url, {
        transports: ['websocket'],
        ...this.options.socketOptions,
      });

      socket.on('rivisk:event', (...args: unknown[]) => {
        const message = args[0] as RealtimeMessage | undefined;
        if (!message?.address) return;
        for (const handler of this.handlers.get(message.address) ?? []) {
          handler(message);
        }
      });

      // Rooms live on the server and do not survive a reconnect.
      socket.on('connect', () => {
        for (const address of this.handlers.keys()) {
          socket.emit('portfolio:subscribe', address);
        }
      });

      this.socket = socket;
      return socket;
    })();
    return this.connecting;
  }

  /** Subscribes to one address. The returned function unsubscribes. */
  async subscribe(address: string, handler: RealtimeHandler): Promise<() => void> {
    const socket = await this.socketRef();
    const existing = this.handlers.get(address);
    if (existing) {
      existing.add(handler);
    } else {
      this.handlers.set(address, new Set([handler]));
      socket.emit('portfolio:subscribe', address);
    }

    return () => {
      const handlers = this.handlers.get(address);
      if (!handlers) return;
      handlers.delete(handler);
      // Only leave the room once nothing is listening for this address.
      if (handlers.size === 0) {
        this.handlers.delete(address);
        this.socket?.emit('portfolio:unsubscribe', address);
      }
    };
  }

  /** Closes the socket and forgets every subscription. */
  close(): void {
    this.handlers.clear();
    this.socket?.disconnect();
    this.socket = null;
    this.connecting = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}
