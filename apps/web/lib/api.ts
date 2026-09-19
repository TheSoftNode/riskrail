import type {
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

export const riskrailApi = {
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
    return request(`/alerts/${encodeURIComponent(address)}`, {
      method: 'POST',
      body: JSON.stringify({ ...input, channel: 'in_app' }),
    });
  },
  setAlertStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    return request(`/alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  policy(address: string) {
    return request<PolicyResponse>(`/policies/${encodeURIComponent(address)}`);
  },
};
