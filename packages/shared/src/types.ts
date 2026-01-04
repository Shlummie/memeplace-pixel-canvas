export interface Pixel {
  x: number;
  y: number;
  color: number;
}

export interface PixelBatch {
  tile: number;
  pixels: Pixel[];
}

export interface BurnCommit {
  v: 1;
  canvas: 'main';
  tile: number;
  commit: string;
}

