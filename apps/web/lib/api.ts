import { accessToken } from '@/lib/auth';
import type {
  Profile,
  ApiKey,
  ApiKeyCreated,
  WebhookEndpoint,
  WebhookCreated,
  AlertMetric,
  AlertOperator,
  AlertsResponse,
  PolicyResponse,
  PortfolioResponse,
  PriceShock,
  RiskResponse,
  SimulationResponse,
  StressScenario,
} from '@/lib/types';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { message?: string | string[]; error?: string };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // The HTTP status still gives us a useful error if the response is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

/** Same as `request`, but attaches the session token and refuses without one. */
async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error('Sign in with your wallet to manage developer settings.');
  return request<T>(path, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
}

export const riviskApi = {
  portfolio(address: string) {
    return request<PortfolioResponse>(`/portfolios/${encodeURIComponent(address)}`);
  },
  risk(address: string) {
    return request<RiskResponse>(`/portfolios/${encodeURIComponent(address)}/risk`);
  },
  refresh(address: string) {
    return request<{ accepted: boolean; correlationId: string }>(`/portfolios/${encodeURIComponent(address)}/refresh`, {
      method: 'POST',
    });
  },
  presets() {
    return request<StressScenario[]>('/simulations/presets');
  },
  simulate(address: string, name: string, shocks: PriceShock[]) {
    return request<SimulationResponse>('/simulations', {
      method: 'POST',
      body: JSON.stringify({ address, name, shocks }),
    });
  },
  alerts(address: string) {
    return request<AlertsResponse>(`/alerts/${encodeURIComponent(address)}`);
  },
  createAlert(
    address: string,
    input: { metric: AlertMetric; operator: AlertOperator; threshold: string },
  ) {
    // Writes are account state and the API checks wallet ownership, so these
    // two carry the session token while the list above stays public.
    return authed(`/alerts/${encodeURIComponent(address)}`, {
      method: 'POST',
      body: JSON.stringify({ ...input, channel: 'in_app' }),
    });
  },
  setAlertStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    return authed(`/alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  policy(address: string) {
    return request<PolicyResponse>(`/policies/${encodeURIComponent(address)}`);
  },

  // ── developer settings (wallet session required) ──────────────────────
  me() {
    return authed<Profile>('/auth/me');
  },
  updateProfile(input: { email?: string; notifyByEmail?: boolean }) {
    return authed<Omit<Profile, 'userId' | 'wallets'>>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  apiKeys() {
    return authed<{ keys: ApiKey[] }>('/api-keys');
  },
  createApiKey(name: string, live: boolean) {
    return authed<ApiKeyCreated>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, live }),
    });
  },
  revokeApiKey(id: string) {
    return authed(`/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  webhooks() {
    return authed<{ endpoints: WebhookEndpoint[] }>('/webhooks');
  },
  createWebhook(url: string, events: string[]) {
    return authed<WebhookCreated>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url, events }),
    });
  },
  setWebhookEnabled(id: string, enabled: boolean) {
    return authed(`/webhooks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },
  deleteWebhook(id: string) {
    return authed(`/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
