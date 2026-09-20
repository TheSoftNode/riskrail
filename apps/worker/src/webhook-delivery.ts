import { prisma } from '@riskrail/database';
import {
  RETRY_BACKOFF_SECONDS,
  decryptSecret,
  signPayload,
  type WebhookEvent,
} from '@riskrail/webhooks';

const TIMEOUT_MS = 10_000;

export interface DeliveryJob {
  endpointId: string;
  event: WebhookEvent;
  attempt: number;
}

export interface DeliveryOutcome {
  delivered: boolean;
  statusCode?: number;
  retryInSeconds?: number;
  error?: string;
}

/**
 * A delivery is successful on any 2xx. 4xx other than 408/429 is treated as a
 * permanent rejection — retrying a malformed-request error just burns attempts.
 */
export function classify(status: number): 'ok' | 'retry' | 'drop' {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 408 || status === 429) return 'retry';
  if (status >= 400 && status < 500) return 'drop';
  return 'retry';
}

export async function deliver(
  job: DeliveryJob,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryOutcome> {
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: job.endpointId },
    select: { id: true, url: true, enabled: true, secretCipher: true },
  });
  if (!endpoint || !endpoint.enabled) {
    return { delivered: false, error: 'endpoint missing or disabled' };
  }

  const body = JSON.stringify(job.event);
  const signature = signPayload(body, decryptSecret(endpoint.secretCipher));

  const record = await prisma.webhookDelivery.create({
    data: { endpointId: endpoint.id, eventId: job.event.id, attempt: job.attempt },
    select: { id: true },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'riskrail-signature': signature,
        'riskrail-event-id': job.event.id,
        'riskrail-event-type': job.event.type,
        'riskrail-delivery-attempt': String(job.attempt),
      },
      body,
      signal: controller.signal,
    });

    const verdict = classify(response.status);
    await prisma.webhookDelivery.update({
      where: { id: record.id },
      data: {
        statusCode: response.status,
        deliveredAt: verdict === 'ok' ? new Date() : null,
      },
    });

    if (verdict === 'ok') return { delivered: true, statusCode: response.status };
    if (verdict === 'drop') return { delivered: false, statusCode: response.status };
    return {
      delivered: false,
      statusCode: response.status,
      retryInSeconds: RETRY_BACKOFF_SECONDS[job.attempt - 1],
    };
  } catch (error) {
    // Network failure or timeout — always worth another attempt.
    await prisma.webhookDelivery.update({
      where: { id: record.id },
      data: { statusCode: null },
    });
    return {
      delivered: false,
      error: error instanceof Error ? error.message : String(error),
      retryInSeconds: RETRY_BACKOFF_SECONDS[job.attempt - 1],
    };
  } finally {
    clearTimeout(timer);
  }
}
