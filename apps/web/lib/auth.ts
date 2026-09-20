"use client";

import { request } from "@stacks/connect";
import { connectRiskRailWallet, restoreRiskRailWallet } from "@/lib/wallet";

const ACCESS = "riskrail_access_token";
const REFRESH = "riskrail_refresh_token";
const ADDRESS = "riskrail_session_address";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
).replace(/\/$/, "");

export interface Session {
  address: string;
  userId: string;
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    // Private browsing or blocked storage — treat as signed out.
    return null;
  }
}

function write(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* non-fatal */
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message = (parsed as { message?: string | string[] })?.message;
    throw new Error(
      Array.isArray(message) ? message.join(", ") : (message ?? `${response.status}`),
    );
  }
  return parsed as T;
}

/**
 * Wallet sign-in. The wallet signs a server-issued challenge; RiskRail never
 * touches a private key and the signature authorises read-only analytics and
 * alert settings, not a transaction.
 */
export async function signIn(): Promise<Session> {
  const address = (await restoreRiskRailWallet()) ?? (await connectRiskRailWallet());

  const challenge = await post<{ message: string }>("/auth/challenge", { address });

  const signed = await request("stx_signMessage", { message: challenge.message });
  if (!signed?.signature || !signed?.publicKey) {
    throw new Error("The wallet did not return a signature.");
  }

  const verified = await post<{
    userId: string;
    address: string;
    accessToken: string;
    refreshToken: string;
  }>("/auth/verify", {
    address,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });

  write(ACCESS, verified.accessToken);
  write(REFRESH, verified.refreshToken);
  write(ADDRESS, verified.address);
  return { address: verified.address, userId: verified.userId };
}

export function signOut() {
  write(ACCESS, null);
  write(REFRESH, null);
  write(ADDRESS, null);
}

export function sessionAddress(): string | null {
  return read(ADDRESS);
}

export function hasSession(): boolean {
  return Boolean(read(ACCESS));
}

/**
 * Returns a usable access token, silently exchanging the refresh token when the
 * access token has expired. Returns null when the user must sign in again.
 */
export async function accessToken(): Promise<string | null> {
  const current = read(ACCESS);
  if (current && !isExpired(current)) return current;

  const refresh = read(REFRESH);
  if (!refresh) return null;

  try {
    const renewed = await post<{ accessToken: string; refreshToken: string }>(
      "/auth/refresh",
      { refreshToken: refresh },
    );
    write(ACCESS, renewed.accessToken);
    write(REFRESH, renewed.refreshToken);
    return renewed.accessToken;
  } catch {
    signOut();
    return null;
  }
}

/** Cheap local expiry check so we refresh before the server rejects us. */
function isExpired(token: string): boolean {
  try {
    const [, payload] = token.split(".");
    if (!payload) return true;
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    if (!exp) return true;
    return Date.now() / 1000 > exp - 30;
  } catch {
    return true;
  }
}
