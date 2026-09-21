import { createHash } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Email delivery for alerts.
 *
 * SMTP is optional: without configuration the sender reports itself as disabled
 * and the worker skips email rather than crashing. That keeps local development
 * and the current deployment working without credentials.
 */

export interface AlertEmailInput {
  address: string;
  metricLabel: string;
  comparison: string;
  observed: string;
  threshold: string;
  source: 'local' | 'on-chain';
  dashboardUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Deterministic per (user, alert, snapshot) so a retry cannot double-send. */
export function dedupeKey(parts: {
  userId: string;
  ruleId: string;
  sourceBlock: string | number;
}): string {
  return createHash('sha256')
    .update(`${parts.userId}:${parts.ruleId}:${parts.sourceBlock}`)
    .digest('hex')
    .slice(0, 32);
}

export function renderAlertEmail(input: AlertEmailInput): RenderedEmail {
  const short =
    input.address.length > 16
      ? `${input.address.slice(0, 7)}…${input.address.slice(-5)}`
      : input.address;

  const subject = `Rivisk: ${input.metricLabel} ${input.comparison} ${input.threshold}`;

  const lines = [
    `${input.metricLabel} for ${short} is now ${input.observed}.`,
    '',
    `Rule: alert when ${input.metricLabel} ${input.comparison} ${input.threshold}`,
    `Source: ${input.source === 'on-chain' ? 'your on-chain risk policy' : 'a Rivisk alert rule'}`,
    '',
    `Review the position: ${input.dashboardUrl}`,
    '',
    'Rivisk is read-only and never moves funds. This is analytics, not',
    'financial advice.',
  ];

  const html = `<!doctype html><html><body style="margin:0;background:#07111F;color:#F8FAFC;font-family:ui-sans-serif,system-ui,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <p style="margin:0 0 24px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#94A3B8">Rivisk alert</p>
  <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600">${escapeHtml(input.metricLabel)} ${escapeHtml(input.comparison)} ${escapeHtml(input.threshold)}</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#94A3B8">
    ${escapeHtml(input.metricLabel)} for <span style="color:#F8FAFC">${escapeHtml(short)}</span>
    is now <span style="color:#F8FAFC">${escapeHtml(input.observed)}</span>.
  </p>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#94A3B8">
    Triggered by ${input.source === 'on-chain' ? 'your on-chain risk policy' : 'a Rivisk alert rule'}.
  </p>
  <a href="${escapeHtml(input.dashboardUrl)}" style="display:inline-block;background:#22D3EE;color:#07111F;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px">Review the position</a>
  <p style="margin:28px 0 0;font-size:12px;line-height:1.7;color:#64748B">
    Rivisk is read-only and never moves funds. Metrics are estimates derived
    from on-chain state and external price sources. This is not financial advice.
  </p>
</div></body></html>`;

  return { subject, text: lines.join('\n'), html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface Mailer {
  enabled: boolean;
  send(to: string, email: RenderedEmail): Promise<{ sent: boolean; error?: string }>;
}

export function createMailer(): Mailer {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;

  if (!host || !from) {
    return {
      enabled: false,
      async send() {
        return { sent: false, error: 'SMTP is not configured' };
      },
    };
  }

  let transport: Transporter | undefined;
  const get = () => {
    transport ??= nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USERNAME
        ? { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD ?? '' }
        : undefined,
    });
    return transport;
  };

  return {
    enabled: true,
    async send(to, email) {
      try {
        await get().sendMail({
          from,
          to,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
        return { sent: true };
      } catch (error) {
        return { sent: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
