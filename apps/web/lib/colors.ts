export function hexToColorIndex(hex: string): number {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return 0;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  const rBits = r >> 5;
  const gBits = g >> 5;
  const bBits = b >> 6;

  return (rBits << 5) | (gBits << 2) | bBits;
}

export function colorIndexToRgb(index: number): { r: number; g: number; b: number } {
  const rBits = (index >> 5) & 0x7;
  const gBits = (index >> 2) & 0x7;
  const bBits = index & 0x3;

  const r = Math.round((rBits / 7) * 255);
  const g = Math.round((gBits / 7) * 255);
  const b = Math.round((bBits / 3) * 255);

  return { r, g, b };
}

export function colorIndexToHex(index: number): string {
  const { r, g, b } = colorIndexToRgb(index);
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

export function normalizeHex(hex: string, fallback = '#000000'): string {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) return fallback.toUpperCase();
  return `#${match[1].toUpperCase()}`;
}

export function hexToColor(hex: string): number {
  const normalized = normalizeHex(hex);
  return Number.parseInt(normalized.slice(1), 16);
}

export function colorToRgb(color: number): { r: number; g: number; b: number } {
  const value = Math.max(0, Math.min(0xffffff, color >>> 0));
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return { r, g, b };
}

export function colorToHex(color: number): string {
  const { r, g, b } = colorToRgb(color);
  const toHex = (component: number) => component.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


