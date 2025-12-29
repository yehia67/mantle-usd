'use client';

import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { UserDashboard } from './user/UserDashboard';
import { MUSDPositionPanel } from './user/MUSDPositionPanel';
import { SuperStakeUserPanel } from './user/SuperStakeUserPanel';
import { PoolsUserPanel } from './user/PoolsUserPanel';
import { useMETH } from '@/hooks/useMETH';
import { useToast } from '@/components/Toast';

export function UserView() {
  const { address } = useAppKitAccount();
  const { mintMETH } = useMETH();
  const { showToast } = useToast();
  const [minting, setMinting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMintMETH = async () => {
    if (!address) {
      showToast('Please connect your wallet', 'error');
      return;
    }
    
    setMinting(true);
    try {
      const txHash = await mintMETH();
      showToast(`Minted 10 mETH! Hash: ${txHash.slice(0, 10)}...`, 'success');
      setTimeout(() => {
        setRefreshKey(prev => prev + 1);
      }, 2000);
    } catch (error) {
      showToast((error as Error).message || 'Mint failed', 'error');
    } finally {
      setMinting(false);
    }
  };

  const handleAddToMetaMask = async () => {
    try {
      const wasAdded = await window.ethereum?.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: '0xDd37c9e2237506273F86dA1272Ca51470dF6e8ae',
            symbol: 'mETH',
            decimals: 18,
          },
        },
      });

      if (wasAdded) {
        showToast('mETH token added to MetaMask!', 'success');
      }
    } catch (error) {
      showToast((error as Error).message || 'Failed to add token', 'error');
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>User Dashboard</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn-outline" 
            onClick={handleAddToMetaMask}
            style={{ fontSize: '14px', padding: '8px 16px' }}
          >
            🦊 Add mETH to MetaMask
          </button>
          <button 
            className="btn-primary" 
            onClick={handleMintMETH}
            disabled={!address || minting}
            style={{ fontSize: '14px', padding: '8px 16px' }}
          >
            {minting ? 'Minting...' : '🪙 Mint 10 mETH'}
          </button>
        </div>
      </div>
      <UserDashboard key={refreshKey} />
      <div className="grid grid-2 mt-4">
        <MUSDPositionPanel />
        <SuperStakeUserPanel />
      </div>
      <div className="mt-4">
        <PoolsUserPanel />
      </div>
    </div>
  );
}
