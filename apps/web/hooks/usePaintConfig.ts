"use client";

import { create } from 'zustand';

import { normalizeHex } from '../lib/colors';

export type ToolMode = 'paint' | 'eyedropper';

interface PaintConfigState {
  activeColor: string;
  setActiveColor: (color: string) => void;
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  toggleToolMode: () => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  toggleGrid: () => void;
}

export const usePaintConfig = create<PaintConfigState>((set) => ({
  activeColor: '#000000',
  setActiveColor: (color) => set({ activeColor: normalizeHex(color) }),
  toolMode: 'paint',
  setToolMode: (mode) => set({ toolMode: mode }),
  toggleToolMode: () => set((state) => ({ 
    toolMode: state.toolMode === 'paint' ? 'eyedropper' : 'paint' 
  })),
  showGrid: true,
  setShowGrid: (show) => set({ showGrid: show }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
}));

