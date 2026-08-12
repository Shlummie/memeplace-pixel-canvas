"use client";

import { useEffect, useRef } from 'react';

import { useSettings } from './useSettings';

interface TileUpdateMessage {
  type: 'tile_update';
  tile: number;
  diff: { x: number; y: number; color: number }[];
}

function isTileUpdateMessage(message: unknown): message is TileUpdateMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const candidate = message as Partial<TileUpdateMessage>;
  if (candidate.type !== 'tile_update') {
    return false;
  }

  if (typeof candidate.tile !== 'number') {
    return false;
  }

  if (!Array.isArray(candidate.diff)) {
    return false;
  }

  return true;
}

export function useDiffSocket(onDiff: (tile: number, diff: { x: number; y: number; color: number }[]) => void) {
  const handlerRef = useRef(onDiff);
  handlerRef.current = onDiff;
  const { settings } = useSettings();

  useEffect(() => {
    const socket = new WebSocket(settings.socketUrl);

    socket.addEventListener('message', (event) => {
      try {
        if (typeof event.data !== 'string') {
          return;
        }

        const message: unknown = JSON.parse(event.data);
        if (isTileUpdateMessage(message)) {
          handlerRef.current(message.tile, message.diff);
        }
      } catch (error) {
        console.error('Failed to parse diff', error);
      }
    });

    return () => socket.close();
  }, [settings.socketUrl]);
}

