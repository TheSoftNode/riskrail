/**
 * End-to-end smoke test against a running Rivisk stack.
 *
 * Unit tests mock the queue and the database, which is how a colon in every
 * BullMQ job id survived a green suite while making the entire async pipeline
 * throw at runtime. This script talks to a real API, Postgres and Redis.
 *
 * It acts as the wallet, generating a throwaway key and signing the challenge
 * itself. Rivisk never sees a private key in real use.
 *
 *   docker compose up -d
 *   pnpm --filter @rivisk/database exec prisma migrate deploy --schema prisma/schema.prisma
 *   node apps/api/dist/main.js &
 *   RIVISK_BASE_URL=http://localhost:4000/api/v1 node apps/api/scripts/smoke.mjs
 */
import { hashMessage } from '@stacks/encryption';
import {
  randomPrivateKey, privateKeyToPublic, publicKeyToHex, publicKeyToAddress, signMessageHashRsv,
} from '@stacks/transactions';
import { RiviskClient } from '@rivisk/sdk';

const BASE = process.env.RIVISK_BASE_URL ?? 'http://localhost:4000/api/v1';
const out = (n, v) => console.log(`${String(n).padEnd(32)} ${v}`);

// A throwaway identity. Rivisk never sees a private key in real use -- the
// browser wallet signs. Here we act as the wallet.
const priv = randomPrivateKey();
const pubHex = publicKeyToHex(privateKeyToPublic(priv));
const address = publicKeyToAddress(pubHex, 'mainnet');
out('generated address', address);

const rivisk = new RiviskClient({ baseUrl: BASE, retry: false });

const challenge = await rivisk.auth.challenge(address);
out('challenge issued', `${challenge.message.split('\n')[0]} (expires ${challenge.expiresIn}s)`);

// RSV signature over the message hash, matching verifyMessageSignatureRsv.
const messageHash = Buffer.from(hashMessage(challenge.message)).toString('hex');
const sigHex = signMessageHashRsv({ messageHash, privateKey: priv });

const session = await rivisk.auth.verify({ address, publicKey: pubHex, signature: sigHex });
out('verify -> session', `user ${session.userId.slice(0,10)}… access ${session.accessToken.slice(0,12)}…`);

out('auth.me', JSON.stringify(await rivisk.auth.me()).slice(0, 110));

const key = await rivisk.apiKeys.create('integration-smoke', false);
out('apiKeys.create', `${key.prefix}… token ${key.token.slice(0, 16)}…`);
out('apiKeys.list', `${(await rivisk.apiKeys.list()).keys.length} key(s)`);

const hook = await rivisk.webhooks.create('https://example.com/rr', ['risk.updated']);
out('webhooks.create', `id ${hook.id.slice(0,8)}… secret ${hook.secret.slice(0,12)}…`);
out('webhooks.list', `${(await rivisk.webhooks.list()).endpoints.length} endpoint(s)`);

const rule = await rivisk.alerts.create(address, { metric: 'healthFactorE4', operator: 'lt', threshold: '13000' });
out('alerts.create (owned)', `${rule.metric} ${rule.operator} ${rule.threshold} [${rule.status}]`);
out('alerts.pause', (await rivisk.alerts.pause(rule.id)).status);

// Ownership: a session for one address must not be able to write to another.
try {
  await rivisk.alerts.create('SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', { metric:'healthFactorE4', operator:'lt', threshold:'13000' });
  out('alerts on someone else', 'ALLOWED -- OWNERSHIP BUG');
} catch (e) { out('alerts on someone else', `blocked ${e.status}`); }

// --- the same account, driven by an API key instead of a session ---------
// Keys must work for integration routes and be refused for key management, so
// a leaked key cannot mint more keys or change the notification email.
const server = new RiviskClient({ baseUrl: BASE, apiKey: key.token, retry: false });
const keyHook = await server.webhooks.create('https://example.com/rr-key', ['alert.triggered']);
out('api key: webhooks.create', `id ${keyHook.id.slice(0, 8)}…`);
out('api key: webhooks.list', `${(await server.webhooks.list()).endpoints.length} endpoint(s)`);
const keyRule = await server.alerts.create(address, { metric: 'riskScoreBps', operator: 'gt', threshold: '8000' });
out('api key: alerts.create', `${keyRule.metric} ${keyRule.operator} ${keyRule.threshold}`);
try { await server.apiKeys.list(); out('api key: apiKeys.list', 'ALLOWED -- KEY CAN MANAGE KEYS (BUG)'); }
catch (e) { out('api key: apiKeys.list', `refused ${e.status} (session only, as intended)`); }
try { await server.auth.updateProfile({ email: `attacker+${Date.now()}@example.com` }); out('api key: updateProfile', 'ALLOWED (BUG)'); }
catch (e) { out('api key: updateProfile', `refused ${e.status}`); }
await server.webhooks.remove(keyHook.id);

out('profile update', JSON.stringify(await rivisk.auth.updateProfile({ email: `dev+${Date.now()}@example.com`, notifyByEmail: true })));
const taken = `taken+${Date.now()}@example.com`;
await rivisk.auth.updateProfile({ email: taken });
{
  const other = randomPrivateKey();
  const otherPub = publicKeyToHex(privateKeyToPublic(other));
  const otherAddr = publicKeyToAddress(otherPub, 'mainnet');
  const second = new RiviskClient({ baseUrl: BASE, retry: false });
  const c = await second.auth.challenge(otherAddr);
  const sig = signMessageHashRsv({ messageHash: Buffer.from(hashMessage(c.message)).toString('hex'), privateKey: other });
  await second.auth.verify({ address: otherAddr, publicKey: otherPub, signature: sig });
  try { await second.auth.updateProfile({ email: taken }); out('email already taken', 'ACCEPTED (BUG)'); }
  catch (e) { out('email already taken', `rejected ${e.status}`); }
}
await rivisk.apiKeys.revoke(key.id); out('apiKeys.revoke', 'ok');
await rivisk.webhooks.remove(hook.id); out('webhooks.remove', 'ok');
