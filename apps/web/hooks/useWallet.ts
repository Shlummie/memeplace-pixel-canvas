"use client";

import { useWallet as useWalletAdapter } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';

export function useWallet() {
  const wallet = useWalletAdapter();

  const walletConnected = wallet.connected && wallet.publicKey;

  return useMemo(
    () => ({
      wallet,
      walletConnected,
      publicKey: wallet.publicKey,
    }),
    [wallet, walletConnected],
  );
}

