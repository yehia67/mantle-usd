'use client';

import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { MANTLE_SEPOLIA_CHAIN_ID } from '@/config/constants';

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { chainId } = useAppKitNetwork();
  const { isConnected } = useAppKitAccount();

  const isCorrectNetwork = !isConnected || chainId === MANTLE_SEPOLIA_CHAIN_ID;

  if (isConnected && !isCorrectNetwork) {
    return (
      <div className="network-warning">
        <h2>Wrong Network</h2>
        <p>Please switch to Mantle Sepolia (Chain ID: {MANTLE_SEPOLIA_CHAIN_ID})</p>
        <p className="text-muted">
          Use the network selector in your wallet or the AppKit button above
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
