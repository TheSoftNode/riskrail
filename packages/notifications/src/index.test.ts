import { afterEach, describe, expect, it } from 'vitest';
import { createMailer, dedupeKey, renderAlertEmail } from './index.js';

const base = {
  address: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
  metricLabel: 'Health factor',
  comparison: 'falls below',
  observed: '1.27',
  threshold: '1.30',
  source: 'local' as const,
  dashboardUrl: 'https://riskrail.dev/dashboard?address=SP2J6ZY48',
};

afterEach(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_FROM;
});

describe('dedupeKey', () => {
  it('is stable for the same alert and snapshot', () => {
    const args = { userId: 'u1', ruleId: 'r1', sourceBlock: 184233 };
    expect(dedupeKey(args)).toBe(dedupeKey(args));
  });

  it('differs per snapshot, so a later breach still sends', () => {
    expect(dedupeKey({ userId: 'u1', ruleId: 'r1', sourceBlock: 1 })).not.toBe(
      dedupeKey({ userId: 'u1', ruleId: 'r1', sourceBlock: 2 }),
    );
  });

  it('differs per user, so one send cannot suppress another', () => {
    expect(dedupeKey({ userId: 'u1', ruleId: 'r1', sourceBlock: 1 })).not.toBe(
      dedupeKey({ userId: 'u2', ruleId: 'r1', sourceBlock: 1 }),
    );
  });
});

describe('renderAlertEmail', () => {
  it('puts the rule in the subject', () => {
    expect(renderAlertEmail(base).subject).toBe(
      'RiskRail: Health factor falls below 1.30',
    );
  });

  it('shortens the address but keeps both ends', () => {
    const { text } = renderAlertEmail(base);
    expect(text).toContain('SP2J6ZY…V9EJ7');
  });

  it('names the trigger source', () => {
    expect(renderAlertEmail(base).text).toContain('a RiskRail alert rule');
    expect(renderAlertEmail({ ...base, source: 'on-chain' }).text).toContain(
      'your on-chain risk policy',
    );
  });

  it('always carries the not-advice disclaimer', () => {
    const { text, html } = renderAlertEmail(base);
    expect(text).toContain('not');
    expect(html).toContain('not financial advice');
  });

  it('escapes html so a crafted label cannot inject markup', () => {
    const { html } = renderAlertEmail({ ...base, metricLabel: '<img src=x onerror=1>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('createMailer', () => {
  it('reports disabled and refuses to send without SMTP config', async () => {
    const mailer = createMailer();
    expect(mailer.enabled).toBe(false);
    await expect(mailer.send('a@b.com', renderAlertEmail(base))).resolves.toMatchObject({
      sent: false,
      error: 'SMTP is not configured',
    });
  });

  it('enables once host and from are present', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'noreply@riskrail.dev';
    expect(createMailer().enabled).toBe(true);
  });
});
