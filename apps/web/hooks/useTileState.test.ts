import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useTileState } from './useTileState';

describe('useTileState', () => {
  it('dedupes staged pixels by coordinate', () => {
    const { result } = renderHook(() => useTileState());

    act(() => {
      result.current.stagePixelAt(10, 10);
      result.current.stagePixelAt(10, 10);
    });

    expect(result.current.stagedPixels).toHaveLength(1);
  });

  it('groups staged pixels by tile and produces per-tile bytes/commits', () => {
    const { result } = renderHook(() => useTileState());

    act(() => {
      result.current.stagePixelAt(10, 10); // tile 0
      result.current.stagePixelAt(150, 150); // tile 15
    });

    expect(result.current.groupedPixels.size).toBe(2);
    expect(result.current.batchBytesByTile.size).toBe(2);
    expect(result.current.commitsByTile.size).toBe(2);
  });
});
