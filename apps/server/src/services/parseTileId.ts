export type ParseSuccess = { kind: 'success'; value: number };
export type ParseError = { kind: 'error'; message: string };
export type ParseResult = ParseSuccess | ParseError;

const TILE_MIN = 0;
const TILE_MAX = 99;

export function parseTileId(raw?: string): ParseResult {
  if (typeof raw !== 'string') {
    return { kind: 'error', message: 'Tile id is required' };
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value)) {
    return { kind: 'error', message: 'Tile id must be an integer' };
  }

  if (value < TILE_MIN || value > TILE_MAX) {
    return { kind: 'error', message: 'Tile id must be between 0 and 99' };
  }

  return { kind: 'success', value };
}
