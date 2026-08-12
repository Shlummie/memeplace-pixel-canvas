import { sha256 } from '../src/hash';

function randomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
}

describe('sha256', () => {
  it('matches the standard SHA-256 vector for abc', () => {
    const data = new TextEncoder().encode('abc');

    expect(sha256(data)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes consistent for same data', () => {
    const data = randomBytes(32);
    const first = sha256(data);
    const second = sha256(new Uint8Array(data));

    expect(first).toBe(second);
  });

  it('hashes different for different data', () => {
    const dataA = randomBytes(64);
    const dataB = randomBytes(64);

    expect(sha256(dataA)).not.toBe(sha256(dataB));
  });
});

