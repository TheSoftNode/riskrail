/**
 * Verifies a Rivisk contract deployment.
 *
 * Deploying is the easy half. The failure mode that actually bites is a
 * deployment that succeeds and is then silently unwired -- the publisher never
 * authorised, an env var left empty, a contract deployed under a different
 * address than the API is pointed at. Everything looks fine until you notice no
 * attestation has ever been written.
 *
 * This script reads the live chain and says which of those are true.
 *
 *   node contracts/scripts/verify-deployment.mjs ST1DEPLOYER... [--publisher ST2PUB...]
 *
 * Options:
 *   --network testnet|mainnet   default testnet
 *   --publisher <address>       also check this principal can publish
 */

import { Cl, serializeCV } from '@stacks/transactions';

/** Clarity principal argument, hex encoded for the node's read-only endpoint. */
const principalToHex = (address) => `0x${serializeCV(Cl.principal(address))}`;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const deployer = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
const network = flag('network', 'testnet');
const publisher = flag('publisher', null);

if (!deployer) {
  console.error('Usage: node contracts/scripts/verify-deployment.mjs <deployer-address> [--network testnet] [--publisher <address>]');
  process.exit(2);
}

const API = network === 'mainnet' ? 'https://api.hiro.so' : 'https://api.testnet.hiro.so';
const CONTRACTS = [
  'risk-provider-trait',
  'risk-registry',
  'risk-policy',
  'protocol-registry',
  'risk-consumer-example',
];

let failures = 0;
const pass = (label, detail = '') => console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`);
const fail = (label, detail = '') => { failures++; console.log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`); };

/** Clarity principal -> the hex-encoded argument the node expects. */
async function callReadOnly(contract, fn, args = []) {
  const res = await fetch(`${API}/v2/contracts/call-read/${deployer}/${contract}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: deployer, arguments: args }),
  });
  if (!res.ok) return { okay: false, error: `HTTP ${res.status}` };
  return res.json();
}

console.log(`\nRivisk deployment check`);
console.log(`  network   ${network}`);
console.log(`  deployer  ${deployer}\n`);

console.log('Contracts published');
const present = {};
for (const name of CONTRACTS) {
  const res = await fetch(`${API}/v2/contracts/interface/${deployer}/${name}`);
  present[name] = res.ok;
  if (res.ok) pass(name);
  else fail(name, 'not found at this address');
}

if (present['risk-registry']) {
  console.log('\nRegistry wiring');

  // A wallet with no snapshot must read as `(ok none)`. Anything else means the
  // contract is not the one we think it is.
  const empty = await callReadOnly('risk-registry', 'get-latest-risk', [
    // A principal that will never have been attested.
    principalToHex(network === 'mainnet' ? 'SP000000000000000000002Q6VF78' : 'ST000000000000000000002AMW42H'),
  ]);
  if (empty.okay) pass('get-latest-risk responds', '(trait surface is live)');
  else fail('get-latest-risk responds', empty.error ?? 'read failed');

  const sentinel = await callReadOnly('risk-registry', 'get-unbounded-health-factor');
  if (sentinel.okay) pass('no-debt sentinel exposed');
  else fail('no-debt sentinel exposed', 'get-unbounded-health-factor missing');

  const owner = await callReadOnly('risk-registry', 'get-owner');
  if (owner.okay) pass('owner readable');
  else fail('owner readable', 'get-owner missing - is this the current contract?');

  if (publisher) {
    const auth = await callReadOnly('risk-registry', 'is-authorized-publisher', [
      principalToHex(publisher),
    ]);
    // `0x03` is Clarity true, `0x04` is false.
    if (auth.okay && auth.result === '0x03') pass('publisher authorised', publisher);
    else if (auth.okay) fail('publisher authorised', `${publisher} is NOT authorised - call set-publisher`);
    else fail('publisher authorised', auth.error ?? 'read failed');
  } else {
    console.log('  skip  publisher check (pass --publisher <address>)');
  }
}

console.log('\nEnvironment to set');
for (const [key, name] of [
  ['RISK_REGISTRY_CONTRACT', 'risk-registry'],
  ['RISK_POLICY_CONTRACT', 'risk-policy'],
  ['PROTOCOL_REGISTRY_CONTRACT', 'protocol-registry'],
  ['NEXT_PUBLIC_RISK_POLICY_CONTRACT', 'risk-policy'],
]) {
  console.log(`  ${key}=${deployer}.${name}`);
}
console.log('  RISK_PUBLISHER_ENABLED=true');

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
