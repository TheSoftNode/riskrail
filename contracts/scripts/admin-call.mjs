/**
 * Sends an owner-only admin call to a deployed Rivisk contract, signed with
 * the deployer key from settings/Testnet.toml.
 *
 * For when the explorer sandbox will not cooperate. It is a dry run by default:
 * it derives the signing address and prints exactly what it would send, and
 * broadcasts nothing until `--send` is passed.
 *
 *   node scripts/admin-call.mjs set-publisher ST1PUB...
 *   node scripts/admin-call.mjs set-publisher ST1PUB... --send
 *
 * Refuses to sign if the key derived from the mnemonic is not the deployer
 * recorded in deployments/testnet.json -- signing with the wrong account costs
 * a fee and fails with (err u100).
 *
 * Never prints the mnemonic or the private key.
 */

import { readFileSync } from 'node:fs';
import { generateWallet } from '@stacks/wallet-sdk';
import {
  Cl,
  PostConditionMode,
  broadcastTransaction,
  getAddressFromPrivateKey,
  makeContractCall,
  makeSTXTokenTransfer,
} from '@stacks/transactions';

const here = new URL('..', import.meta.url);
const deployment = JSON.parse(readFileSync(new URL('deployments/testnet.json', here), 'utf8'));
const settings = readFileSync(new URL('settings/Testnet.toml', here), 'utf8');

const [command, ...rest] = process.argv.slice(2);
const send = rest.includes('--send');
const args = rest.filter((a) => a !== '--send');

/** Supported calls. Each maps CLI args to a contract, function and Clarity args. */
const CALLS = {
  // Not an admin call: exercises the example consumer against the live
  // registry, i.e. another contract reading Rivisk through the trait and
  // deciding from it. Anyone may call it; the deployer just pays the fee.
  'open-position': {
    contract: 'risk-consumer-example',
    usage: 'open-position <user-address>',
    build: ([user]) => [
      Cl.contractPrincipal(deployment.deployer, 'risk-registry'),
      Cl.principal(user),
    ],
  },
  // Not a contract call: a plain STX transfer from the deployer, e.g. to fund
  // a publisher account for fees. Amount is in micro-STX.
  'transfer-stx': {
    transfer: true,
    usage: 'transfer-stx <recipient> <micro-stx>',
  },
  'set-publisher': {
    contract: 'risk-registry',
    usage: 'set-publisher <publisher-address> [false]',
    build: ([publisher, enabled = 'true']) => [Cl.principal(publisher), Cl.bool(enabled !== 'false')],
  },
  'register-protocol': {
    contract: 'protocol-registry',
    usage: 'register-protocol <id> <name> <type> <contract-principal> <adapter-version> [metadata-sha256-hex]',
    build: ([id, name, type, principal, version, metadata]) => [
      Cl.uint(Number(id)),
      Cl.stringAscii(name),
      Cl.stringAscii(type),
      Cl.principal(principal),
      Cl.uint(Number(version)),
      // Pins the adapter descriptor, so a consumer can tell whether the
      // interpretation of a protocol changed between two snapshots.
      Cl.bufferFromHex((metadata ?? '00'.repeat(32)).replace(/^0x/, '')),
    ],
  },
};

const call = CALLS[command];
if (!call) {
  console.error(`Usage:\n${Object.values(CALLS).map((c) => `  node scripts/admin-call.mjs ${c.usage} [--send]`).join('\n')}`);
  process.exit(2);
}

const mnemonic = settings.match(/^\s*mnemonic\s*=\s*"([^"]+)"/m)?.[1];
if (!mnemonic || mnemonic.split(/\s+/).length < 12) {
  console.error('No usable mnemonic in settings/Testnet.toml.');
  process.exit(2);
}

// Index 0, matching the account clarinet deployed from.
const wallet = await generateWallet({ secretKey: mnemonic, password: '' });
const privateKey = wallet.accounts[0].stxPrivateKey;
const signer = getAddressFromPrivateKey(privateKey, 'testnet');

if (signer !== deployment.deployer) {
  console.error(`Refusing to sign: the key derives ${signer}, but the contracts are owned by ${deployment.deployer}.`);
  process.exit(1);
}

// The API's default nonce lookup ignores transactions still in the mempool, so
// sending several calls back to back reuses a nonce and the later ones are
// rejected. `possible_next_nonce` accounts for pending transactions.
const nonces = await (await fetch(`https://api.testnet.hiro.so/extended/v1/address/${signer}/nonces`)).json();
const nonce = BigInt(nonces.possible_next_nonce);

console.log(`\n  signer    ${signer}  (matches deployer)`);
if (call.transfer) {
  console.log(`  transfer  ${Number(args[1]) / 1e6} STX -> ${args[0]}`);
} else {
  console.log(`  contract  ${deployment.contracts[call.contract].id}`);
  console.log(`  function  ${command}(${args.join(', ')})`);
}
console.log(`  nonce     ${nonce}`);

if (!send) {
  console.log('\n  Dry run. Nothing was broadcast. Add --send to submit.\n');
  process.exit(0);
}

const transaction = call.transfer
  ? await makeSTXTokenTransfer({
      recipient: args[0],
      amount: BigInt(args[1]),
      senderKey: privateKey,
      network: 'testnet',
      nonce,
      memo: 'rivisk publisher fees',
    })
  : await makeContractCall({
  contractAddress: deployment.contracts[call.contract].id.split('.')[0],
  contractName: deployment.contracts[call.contract].id.split('.')[1],
  functionName: command,
  functionArgs: call.build(args),
  senderKey: privateKey,
  network: 'testnet',
  nonce,
  // Admin calls move no tokens, so deny mode with no post conditions is the
  // strict setting: any unexpected transfer makes the transaction fail.
  postConditionMode: PostConditionMode.Deny,
});

const result = await broadcastTransaction({ transaction, network: 'testnet' });
if ('error' in result && result.error) {
  console.error(`\n  Broadcast rejected: ${result.error} ${result.reason ?? ''}\n`);
  process.exit(1);
}
console.log(`\n  Broadcast: ${result.txid}`);
console.log(`  https://explorer.hiro.so/txid/0x${result.txid.replace(/^0x/, '')}?chain=testnet\n`);
