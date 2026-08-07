#!/usr/bin/env node
/**
 * CONTROLLED REAL-PROVIDER SMOKE TEST
 *
 * Sends exactly ONE message through the configured provider to a number you
 * name, and reports what came back. It is the last step before a pilot: the
 * one thing the whole test suite cannot prove is that these credentials, this
 * sending number and this carrier will move a real message to a real handset.
 *
 *   npm run smoke:provider -- --to +15555550123
 *
 * SAFETY. This is the only script in the repository that can spend money and
 * ring a stranger's phone, so it is deliberately hard to run by accident:
 *
 *   - It refuses without SMOKE_TEST_CONFIRM=i-understand-this-sends-a-real-sms.
 *   - It refuses without an explicit --to. There is no default recipient.
 *   - It sends ONE message. There is no loop, no batch, no list file.
 *   - It never reads the tenant database, so it cannot pick up a customer's
 *     number by mistake — the destination is only ever what you typed.
 *   - It prints the destination masked.
 *
 * It does NOT prove delivery. The provider accepting a message is not a
 * handset receiving one; watch the dashboard for the delivery receipt, or
 * check the phone.
 */

import { argv, env, exit } from 'node:process';

const CONFIRM_PHRASE = 'i-understand-this-sends-a-real-sms';

function fail(message) {
  console.error(`\n  REFUSED: ${message}\n`);
  exit(1);
}

function arg(name) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function mask(value) {
  const digits = String(value).replace(/\D/g, '');
  return digits.length < 4 ? '***' : `***${digits.slice(-4)}`;
}

const to = arg('to');
const from = arg('from') ?? env.SMOKE_TEST_FROM;

if (env.SMOKE_TEST_CONFIRM !== CONFIRM_PHRASE) {
  fail(
    `this sends a real SMS and may cost money.\n` +
      `  Set SMOKE_TEST_CONFIRM=${CONFIRM_PHRASE} to proceed.`,
  );
}
if (!to) fail('no --to given. There is no default recipient, on purpose.');
if (!/^\+\d{8,15}$/.test(to)) fail(`--to must be E.164, e.g. +15555550123 (got ${mask(to)}).`);
if (!from) fail('no --from given and SMOKE_TEST_FROM is unset. This must be your provisioned sending number.');

const provider = (env.SMS_PROVIDER ?? '').toLowerCase().trim();
if (!provider) fail('SMS_PROVIDER is not set.');
if (provider === 'mock') {
  fail('SMS_PROVIDER=mock. A smoke test against the mock proves nothing about a real carrier.');
}

console.log('\n  Winners Bookmark — provider smoke test');
console.log(`  provider : ${provider}`);
console.log(`  from     : ${mask(from)}`);
console.log(`  to       : ${mask(to)}`);
console.log('  messages : 1\n');

// Imported lazily and only after every guard has passed, so a misconfigured
// run cannot construct a live provider on the way to being refused.
const { getSmsProvider } = await import('../src/lib/frontdesk/notify/provider.ts');

let adapter;
try {
  adapter = await getSmsProvider(env);
} catch (error) {
  fail(error instanceof Error ? error.message : 'provider could not be configured');
}
if (!adapter) fail('no provider resolved from SMS_PROVIDER.');
if (adapter.simulated) fail('the resolved provider is simulated. Refusing to report a simulated send as a smoke test.');

const reference = `smoke-${Date.now()}`;
const result = await adapter.send({
  to,
  from,
  body:
    'Winners Bookmark front desk — provider smoke test. ' +
    'If you received this, the SMS path works end to end. Reply STOP to opt out.',
  reference,
  idempotencyKey: reference,
});

console.log(`  status         : ${result.status}`);
console.log(`  providerMsgId  : ${result.providerMessageId ?? '(none)'}`);
if (result.errorCode) console.log(`  errorCode      : ${result.errorCode}`);
if (result.errorMessage) console.log(`  errorMessage   : ${result.errorMessage}`);
console.log(`  retryable      : ${result.retryable}`);

if (result.status !== 'ACCEPTED') {
  console.error('\n  The provider did NOT accept the message. Fix this before a pilot.\n');
  exit(2);
}

console.log(
  '\n  ACCEPTED by the provider. This is not proof of delivery.\n' +
    '  Confirm the handset received it, and check that a delivery receipt\n' +
    '  arrived at the notifications webhook. Without the receipt, every alert\n' +
    '  in production will look successful whether or not it arrives.\n',
);
