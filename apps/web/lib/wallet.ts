'use client';

import { connect, disconnect, getLocalStorage, isConnected } from '@stacks/connect';

const EXPLICIT_CONNECTION_KEY = 'rivisk_wallet_explicitly_connected';

function getStacksAddress(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const addresses = data.addresses as Record<string, unknown> | undefined;
  const stx = addresses?.stx;
  if (Array.isArray(stx)) {
    const first = stx[0];
    if (first && typeof first === 'object' && typeof (first as Record<string, unknown>).address === 'string') {
      return (first as Record<string, unknown>).address as string;
    }
  }
  if (stx && typeof stx === 'object' && typeof (stx as Record<string, unknown>).address === 'string') {
    return (stx as Record<string, unknown>).address as string;
  }
  return null;
}

export async function connectRiviskWallet(): Promise<string> {
  await connect();
  const address = getStacksAddress(getLocalStorage());
  if (!address) throw new Error('The wallet connected, but no Stacks address was returned.');
  localStorage.setItem(EXPLICIT_CONNECTION_KEY, 'true');
  return address;
}

export async function restoreRiviskWallet(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem(EXPLICIT_CONNECTION_KEY) !== 'true') return null;
  if (!isConnected()) return null;
  return getStacksAddress(getLocalStorage());
}

export async function disconnectRiviskWallet() {
  await disconnect();
  if (typeof window !== 'undefined') localStorage.removeItem(EXPLICIT_CONNECTION_KEY);
}
