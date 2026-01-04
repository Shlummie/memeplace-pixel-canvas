"use client";
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-misused-promises */

import { useCallback, useEffect, useState } from 'react';
import styles from '../../app/page.module.css';
import { usePaintConfig } from '../../hooks/usePaintConfig';
import { isPixel, useTileState } from '../../hooks/useTileState';
import { colorToHex } from '../../lib/colors';
import { useWallet } from '../../hooks/useWallet';

// Color palette inspired by r/place - 32 colors
const COLOR_PALETTE = [
  // Row 1 - Reds & Oranges
  '#BE0039', '#FF4500', '#FFA800', '#FFD635',
  // Row 2 - Yellows & Greens  
  '#FFF8B8', '#00A368', '#00CC78', '#7EED56',
  // Row 3 - Teals & Blues
  '#00756F', '#009EAA', '#00CCC0', '#2450A4',
  // Row 4 - Blues & Purples
  '#3690EA', '#51E9F4', '#493AC1', '#6A5CFF',
  // Row 5 - Purples & Pinks
  '#94B3FF', '#811E9F', '#B44AC0', '#E4ABFF',
  // Row 6 - Pinks & Browns
  '#DE107F', '#FF3881', '#FF99AA', '#6D482F',
  // Row 7 - Browns & Grays
  '#9C6926', '#FFB470', '#000000', '#515252',
  // Row 8 - Grays & White
  '#898D90', '#D4D7D9', '#FFFFFF', '#FF6969',
];

// Check if a string is a valid complete hex color
const isValidHex = (hex: string): boolean => {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
};

export function ToolPanel() {
  const {
    stagedPixels,
    undoLast,
    clear,
    burnAndSubmit,
    isSubmitting,
    error,
    checkCooldown,
  } = useTileState();

  const { 
    activeColor, 
    setActiveColor, 
    toolMode, 
    toggleToolMode,
    showGrid,
    toggleGrid,
  } = usePaintConfig();

  const { wallet } = useWallet();
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  // Local state for hex input to allow typing partial values
  const [hexInputValue, setHexInputValue] = useState(activeColor);
  
  // Sync local input when activeColor changes from palette clicks
  useEffect(() => {
    setHexInputValue(activeColor);
  }, [activeColor]);
  
  // Handle hex input changes - allow typing, only update color when valid
  const handleHexInputChange = (value: string) => {
    // Ensure it starts with #
    let normalized = value.toUpperCase();
    if (!normalized.startsWith('#')) {
      normalized = '#' + normalized;
    }
    // Limit to 7 characters (#RRGGBB)
    normalized = normalized.slice(0, 7);
    // Only allow valid hex characters after #
    normalized = '#' + normalized.slice(1).replace(/[^0-9A-F]/g, '');
    
    setHexInputValue(normalized);
    
    // Only update the actual color when it's a complete valid hex
    if (isValidHex(normalized)) {
      setActiveColor(normalized);
    }
  };

  const refreshCooldown = useCallback(async () => {
    const result = await checkCooldown();
    setCooldownRemaining(result.remainingSeconds);
  }, [checkCooldown]);

  // Check cooldown on mount and when wallet changes
  useEffect(() => {
    if (wallet.publicKey) {
      void refreshCooldown();
    } else {
      setCooldownRemaining(0);
    }
  }, [wallet.publicKey, refreshCooldown]);

  // Countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const pixels = Array.isArray(stagedPixels)
    ? stagedPixels.filter(isPixel)
    : [];

  const stagedTotal = pixels.length;
  const latestPixel = pixels.at(-1);

  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const isOnCooldown = cooldownRemaining > 0;

  const handleBurnAndSubmit = async () => {
    await burnAndSubmit();
    // After burning, refresh cooldown to show the new timer
    await refreshCooldown();
  };

  return (
    <div className={styles.stack}>
      <section className={styles.panelGroup}>
        <header className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Color</span>
          <button
            type="button"
            className={`${styles.toolToggleSmall} ${toolMode === 'eyedropper' ? styles.toolToggleActive : ''}`}
            onClick={toggleToolMode}
            title="Eyedropper (E) - Pick color from canvas"
            aria-label="Toggle eyedropper"
          >
            💧
          </button>
        </header>
        
        {/* Color palette grid */}
        <div className={styles.colorPalette}>
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={`${styles.colorSwatch} ${activeColor.toUpperCase() === color.toUpperCase() ? styles.colorSwatchActive : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setActiveColor(color)}
              aria-label={`Select color ${color}`}
              title={color}
            />
          ))}
        </div>

        {/* Custom color picker */}
        <div className={styles.customColorRow}>
          <input
            type="color"
            className={styles.colorInput}
            value={activeColor}
            onChange={(event) => setActiveColor(event.target.value)}
            aria-label="Custom color picker"
          />
          <input
            type="text"
            className={styles.hexInput}
            value={hexInputValue}
            onChange={(event) => handleHexInputChange(event.target.value)}
            onBlur={() => {
              // On blur, reset to the actual active color if input is invalid
              if (!isValidHex(hexInputValue)) {
                setHexInputValue(activeColor);
              }
            }}
            placeholder="#RRGGBB"
            maxLength={7}
            aria-label="Hex color"
          />
          <div 
            className={styles.colorPreview}
            style={{ backgroundColor: activeColor }}
            title={`Current: ${activeColor}`}
          />
        </div>
      </section>

      <section className={styles.panelGroup}>
        <header className={styles.sectionTitle}>Staged Pixels</header>
        <div className={styles.pixelList}>
          {stagedTotal === 0 && <div>No pixels staged.</div>}
          {pixels.map((pixel) => {
            const hex = colorToHex(pixel.color);
            return (
              <div key={`${pixel.x}-${pixel.y}`} className={styles.pixelRow}>
                <span>
                  ({pixel.x}, {pixel.y})
                </span>
                <span>#{hex}</span>
              </div>
            );
          })}
        </div>
        <div className={styles.stack}>
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={stagedTotal === 0}
            onClick={undoLast}
          >
            Undo Last
          </button>
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={stagedTotal === 0}
            onClick={clear}
          >
            Clear All
          </button>
        </div>
      </section>

      <section className={styles.panelGroup}>
        <header className={styles.sectionTitle}>Burn & Place</header>
        <button
          type="button"
          className={styles.button}
          disabled={stagedTotal === 0 || !!isSubmitting || isOnCooldown}
          onClick={() => {
            void handleBurnAndSubmit();
          }}
        >
          {isSubmitting
            ? 'Submitting…'
            : isOnCooldown
              ? `Cooldown: ${formatCooldown(cooldownRemaining)}`
              : `Burn ${stagedTotal} Pixel${stagedTotal === 1 ? '' : 's'}`}
        </button>
        {latestPixel && (
          <span className={styles.status}>
            Latest: ({latestPixel.x}, {latestPixel.y})
          </span>
        )}
        {isOnCooldown && !isSubmitting && (
          <span className={styles.status}>
            Wait {formatCooldown(cooldownRemaining)} before next burn
          </span>
        )}
        {error && <span className={styles.status}>Error: {error}</span>}
      </section>

      {/* Keyboard Shortcuts */}
      <section className={styles.panelGroup}>
        <header className={styles.sectionTitle}>Shortcuts</header>
        <div className={styles.shortcutList}>
          <div className={styles.shortcutRow}>
            <kbd>E</kbd>
            <span>Eyedropper {toolMode === 'eyedropper' ? '(active)' : ''}</span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>G</kbd>
            <span>Toggle Grid {showGrid ? '(on)' : '(off)'}</span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>Ctrl+Z</kbd>
            <span>Undo</span>
          </div>
          <div className={styles.shortcutRow}>
            <kbd>+</kbd> / <kbd>−</kbd>
            <span>Zoom</span>
          </div>
        </div>
      </section>
    </div>
  );
}

