import { describe, it, expect } from 'vitest';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import { verifyCommitSignature } from '../src/services/verifyCommitSignature';

function buildMemo(tileCommitPairs: Array<{ tile: number; commit: string }>): string {
  return Buffer.from(
    JSON.stringify({ v: 1, canvas: 'main', commits: tileCommitPairs }),
    'utf8',
  ).toString('base64');
}

describe('verifyCommitSignature', () => {
  it('verifies a valid signature for memo payload', () => {
    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const memoB64 = buildMemo([{ tile: 1, commit: 'def' }]);
    const message = `BURN_COMMIT:sig123:${memoB64}`;
    const signed = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
    const signedB64 = Buffer.from(signed).toString('base64');

    expect(() => verifyCommitSignature(wallet, signedB64, 'sig123', memoB64)).not.toThrow();
  });

  it('throws on invalid signature', () => {
    const keypair = nacl.sign.keyPair();
    const wallet = bs58.encode(keypair.publicKey);
    const memoB64 = buildMemo([{ tile: 1, commit: 'def' }]);
    const otherKey = nacl.sign.keyPair();
    const signed = nacl.sign.detached(
      new TextEncoder().encode(`BURN_COMMIT:sig123:${memoB64}`),
      otherKey.secretKey,
    );
    const signedB64 = Buffer.from(signed).toString('base64');

    expect(() => verifyCommitSignature(wallet, signedB64, 'sig123', memoB64)).toThrow('Invalid signed message');
  });
});

