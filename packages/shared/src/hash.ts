import { sha256 as digestSha256 } from '@noble/hashes/sha256';

export function sha256(data: Uint8Array): string {
  return Array.from(digestSha256(data), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

