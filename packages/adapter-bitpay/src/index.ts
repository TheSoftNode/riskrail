import type { AdapterContext, NormalizedPosition, ProtocolAdapter, ProtocolMetadata } from '@riskrail/adapter-core';
import { StacksClient } from '@riskrail/stacks';
import { principalCV, uintCV } from '@stacks/transactions';

export interface BitPayStream {
  sender: string;
  recipient: string;
  totalAmountAtomic: string;
  withdrawnAmountAtomic: string;
  vestedAmountAtomic: string;
  startBlock: number;
  endBlock: number;
  cancelled: boolean;
}

export interface BitPayReader {
  getStreamIds(address: string): Promise<number[]>;
  getStream(streamId: number): Promise<BitPayStream | null>;
}

/**
 * Reads the existing BitPay streaming contract directly from Stacks.
 *
 * The reader intentionally keeps contract access outside the adapter mapping logic.
 * That makes it straightforward to replace direct reads with indexed Chainhook state
 * later without changing RiskRail's normalized position model.
 */
export class StacksBitPayReader implements BitPayReader {
  private readonly client: StacksClient;

  constructor(
    stacksApiUrl: string,
    private readonly contractId: string,
    private readonly senderAddress?: string,
    apiKey?: string,
  ) {
    this.client = new StacksClient(stacksApiUrl, apiKey);
  }

  async getStreamIds(address: string): Promise<number[]> {
    const [sent, received] = await Promise.all([
      this.client.callReadOnly(this.contractId, 'get-sender-streams', [principalCV(address)], this.senderAddress ?? address),
      this.client.callReadOnly(this.contractId, 'get-recipient-streams', [principalCV(address)], this.senderAddress ?? address),
    ]);
    return [...new Set([...decodeUintList(sent), ...decodeUintList(received)])].sort((a, b) => a - b);
  }

  async getStream(streamId: number): Promise<BitPayStream | null> {
    const [streamJson, vestedJson] = await Promise.all([
      this.client.callReadOnly(this.contractId, 'get-stream', [uintCV(streamId)], this.senderAddress),
      this.client.callReadOnly(this.contractId, 'get-vested-amount', [uintCV(streamId)], this.senderAddress),
    ]);

    const stream = decodeOptionalTuple(streamJson);
    if (!stream) return null;

    return {
      sender: asString(stream['sender']),
      recipient: asString(stream['recipient']),
      totalAmountAtomic: asUintString(stream['amount']),
      withdrawnAmountAtomic: asUintString(stream['withdrawn']),
      vestedAmountAtomic: asUintString(unwrapResponseValue(vestedJson)),
      startBlock: asNumber(stream['start-block']),
      endBlock: asNumber(stream['end-block']),
      cancelled: asBoolean(stream['cancelled']),
    };
  }
}

export class BitPayAdapter implements ProtocolAdapter {
  constructor(
    private readonly reader: BitPayReader,
    private readonly contractId: string,
  ) {}

  metadata(): ProtocolMetadata {
    return {
      id: 'bitpay',
      name: 'BitPay',
      type: 'streaming-payments',
      contracts: [this.contractId],
    };
  }

  async supports(address: string): Promise<boolean> {
    return (await this.reader.getStreamIds(address)).length > 0;
  }

  async getPositions(address: string, context: AdapterContext): Promise<NormalizedPosition[]> {
    const ids = await this.reader.getStreamIds(address);
    const positions: NormalizedPosition[] = [];

    for (const streamId of ids) {
      const stream = await this.reader.getStream(streamId);
      if (!stream) continue;

      const total = BigInt(stream.totalAmountAtomic);
      const withdrawn = BigInt(stream.withdrawnAmountAtomic);
      const vested = BigInt(stream.vestedAmountAtomic);
      const outstanding = total > withdrawn ? total - withdrawn : 0n;
      if (stream.cancelled || outstanding === 0n) continue;

      const currentlyWithdrawable = vested > withdrawn ? vested - withdrawn : 0n;
      const relationship = address === stream.recipient ? 'recipient' : 'sender';
      const liquidBps = relationship === 'recipient'
        ? Number((currentlyWithdrawable * 10_000n) / outstanding)
        : 0;

      // Recipient claims are counted as portfolio assets. Sender-side streams are
      // kept as commitment metadata but are not counted again as positive assets,
      // which avoids double-counting the same locked sBTC across both parties.
      const assets = relationship === 'recipient'
        ? [{
            assetId: 'sBTC',
            symbol: 'sBTC',
            amountAtomic: outstanding.toString(),
            decimals: 8,
            role: 'locked' as const,
          }]
        : [];

      positions.push({
        id: `bitpay:${streamId}:${address}`,
        owner: address,
        protocol: this.metadata(),
        type: 'stream',
        assets,
        accessibility: relationship === 'recipient' ? {
          liquidBps: Math.max(0, Math.min(10_000, liquidBps)),
          lockedUntilBlock: stream.endBlock,
        } : undefined,
        source: {
          blockHeight: context.blockHeight ?? 0,
          observedAt: new Date().toISOString(),
          exact: true,
        },
        metadata: {
          streamId,
          relationship,
          sender: stream.sender,
          recipient: stream.recipient,
          cancelled: stream.cancelled,
          totalAmountAtomic: total.toString(),
          withdrawnAmountAtomic: withdrawn.toString(),
          vestedAmountAtomic: vested.toString(),
          withdrawableAmountAtomic: currentlyWithdrawable.toString(),
          startBlock: stream.startBlock,
          endBlock: stream.endBlock,
        },
      });
    }
    return positions;
  }
}

// cvToJSON has changed slightly across Stacks.js releases. These decoders accept
// both the typed { type, value } shape and already-unwrapped primitive structures.
function unwrapNode(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(unwrapNode);
  if (typeof input !== 'object') return input;

  const node = input as Record<string, unknown>;
  const type = typeof node['type'] === 'string' ? node['type'].toLowerCase() : '';
  if (type.includes('optional') && (node['value'] === null || type.includes('none'))) return null;
  if (type.includes('response') || type.includes('optional') || type.includes('list') || type.includes('tuple')) {
    return unwrapNode(node['value']);
  }
  if (type.includes('uint') || type.includes('int') || type.includes('principal') || type.includes('string') || type.includes('bool')) {
    return unwrapNode(node['value']);
  }

  if ('value' in node && Object.keys(node).length <= 3) return unwrapNode(node['value']);
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, unwrapNode(value)]));
}

function decodeUintList(input: unknown): number[] {
  const value = unwrapNode(input);
  if (!Array.isArray(value)) return [];
  return value.map(asNumber).filter((value) => Number.isSafeInteger(value) && value >= 0);
}

function decodeOptionalTuple(input: unknown): Record<string, unknown> | null {
  const value = unwrapNode(input);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unwrapResponseValue(input: unknown): unknown {
  return unwrapNode(input);
}

function asNumber(value: unknown): number {
  const unwrapped = unwrapNode(value);
  if (typeof unwrapped === 'bigint') return Number(unwrapped);
  if (typeof unwrapped === 'number') return unwrapped;
  if (typeof unwrapped === 'string') return Number(unwrapped.replace(/^u/, ''));
  throw new Error(`Expected numeric Clarity value, received ${String(unwrapped)}`);
}

function asUintString(value: unknown): string {
  const unwrapped = unwrapNode(value);
  if (typeof unwrapped === 'bigint') return unwrapped.toString();
  if (typeof unwrapped === 'number') return Math.trunc(unwrapped).toString();
  if (typeof unwrapped === 'string') return unwrapped.replace(/^u/, '');
  throw new Error(`Expected uint Clarity value, received ${String(unwrapped)}`);
}

function asString(value: unknown): string {
  const unwrapped = unwrapNode(value);
  if (typeof unwrapped === 'string') return unwrapped;
  throw new Error(`Expected string Clarity value, received ${String(unwrapped)}`);
}

function asBoolean(value: unknown): boolean {
  const unwrapped = unwrapNode(value);
  if (typeof unwrapped === 'boolean') return unwrapped;
  if (typeof unwrapped === 'string') return unwrapped === 'true';
  return Boolean(unwrapped);
}
