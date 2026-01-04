import bs58 from 'bs58';
import nacl from 'tweetnacl';

export function verifyCommitSignature(wallet: string, signatureB64: string, sig: string, memoB64: string) {
  const message = `BURN_COMMIT:${sig}:${memoB64}`;
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = Buffer.from(signatureB64, 'base64');
  const publicKeyBytes = bs58.decode(wallet);

  const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

  if (!valid) {
    throw new Error('Invalid signed message');
  }
}

