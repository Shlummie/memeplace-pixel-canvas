"use client";

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import styles from '../../app/page.module.css';
import { useSettings } from '../../hooks/useSettings';

const WalletButton = dynamic(async () => import('../wallet/WalletButton'));

export function Toolbar() {
  const [showSettings, setShowSettings] = useState(false);
  const { settings, loadRemoteConfig } = useSettings();

  useEffect(() => {
    void loadRemoteConfig();
  }, [loadRemoteConfig]);

  const TOKEN_DECIMALS = 6;

  const formattedCooldown = useMemo(() => {
    if (!Number.isFinite(settings.walletCooldownSeconds)) {
      return 'Unknown';
    }
    const minutes = Math.floor(settings.walletCooldownSeconds / 60);
    const seconds = settings.walletCooldownSeconds % 60;
    if (minutes > 0 && seconds > 0) {
      return `${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }, [settings.walletCooldownSeconds]);

  const pixelCostTokens = useMemo(() => {
    const divisor = 10 ** TOKEN_DECIMALS;
    const value = settings.pixelCost / divisor;
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: value < 1 ? Math.min(2, TOKEN_DECIMALS) : 0,
      maximumFractionDigits: TOKEN_DECIMALS,
    });
    return formatter.format(value);
  }, [settings.pixelCost]);

  const pixelCostRaw = useMemo(() => new Intl.NumberFormat().format(settings.pixelCost), [settings.pixelCost]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.panelGroup}>
        <div className={styles.sectionTitle}>Wallet</div>
        <WalletButton />
      </div>

      <div className={styles.panelGroup}>
        <button
          type="button"
          className={styles.settingsToggle}
          onClick={() => setShowSettings((value) => !value)}
        >
          <span>Paint &amp; Burn Info</span>
          <span aria-hidden>{showSettings ? '−' : '+'}</span>
        </button>
        {showSettings && (
          <div className={styles.settingsContent}>
            <div>
              <div className={styles.sectionTitle}>Cost Per Pixel</div>
              <span>{pixelCostTokens} tokens</span>
              <span className={styles.settingsNote}>
                {pixelCostRaw} base units (1 token = 1e{TOKEN_DECIMALS} base units)
              </span>
            </div>
            <div>
              <div className={styles.sectionTitle}>Max Pixels Per Burn</div>
              <span>{settings.maxPixelsPerBatch}</span>
            </div>
            <div>
              <div className={styles.sectionTitle}>Wallet Cooldown</div>
              <span>{formattedCooldown}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

