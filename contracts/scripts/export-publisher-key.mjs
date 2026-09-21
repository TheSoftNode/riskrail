// Writes the authorised publisher's key to a file for the production worker:
//
//   node scripts/export-publisher-key.mjs ../infrastructure/deploy/publisher.env
//
// The key is derived from the seed in settings/Testnet.toml (account index 1),
// checked against the publisher recorded in deployments/testnet.json, and
// written with mode 600. It is never printed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateNewAccount, generateWallet } from '@stacks/wallet-sdk';
import { getAddressFromPrivateKey } from '@stacks/transactions';

const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/export-publisher-key.mjs <output-file>');
  process.exit(1);
}
if (existsSync(out)) {
  console.error(`${out} already exists; not overwriting it.`);
  process.exit(1);
}

const here = new URL('..', import.meta.url);
const deployment = JSON.parse(readFileSync(new URL('deployments/testnet.json', here), 'utf8'));
const settings = readFileSync(new URL('settings/Testnet.toml', here), 'utf8');
const mnemonic = settings.match(/^\s*mnemonic\s*=\s*"([^"]+)"/m)?.[1];
if (!mnemonic || mnemonic.split(/\s+/).length < 12) {
  console.error('No usable mnemonic in settings/Testnet.toml.');
  process.exit(1);
}

const wallet = generateNewAccount(await generateWallet({ secretKey: mnemonic, password: '' }));
const key = wallet.accounts[1].stxPrivateKey;
const address = getAddressFromPrivateKey(key, 'testnet');
if (address !== deployment.publisher) {
  console.error(`Refusing: index 1 derives ${address}, but the publisher is ${deployment.publisher}.`);
  process.exit(1);
}

writeFileSync(out, `RISK_PUBLISHER_SECRET_KEY=${key}\n`, { mode: 0o600 });
console.log(`Wrote the key for ${address} to ${out} (mode 600, not printed).`);
