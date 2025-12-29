'use client';

import { useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { formatMUSD, formatToken } from '@/utils/format';
import { useRWAPoolFactory } from '@/hooks/useRWAPoolFactory';
import { useAppKitAccount } from '@reown/appkit/react';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import { useToast } from '@/components/Toast';

const GET_ALL_POOLS = gql`
  query GetAllPools {
    rwapools {
      id
      assetSymbol
      reserveMUSD
      reserveRWA
      totalLiquidity
      totalVolume
      totalSwaps
      verifier
      policyId
    }
  }
`;

interface PoolsAdminPanelProps {
  onTransactionComplete?: () => void;
}

export function PoolsAdminPanel({ onTransactionComplete }: PoolsAdminPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [rwaToken, setRwaToken] = useState('');
  const [verifier, setVerifier] = useState('');
  const [imageId, setImageId] = useState('');
  const { data, loading, refetch } = useQuery(GET_ALL_POOLS);
  const { address } = useAppKitAccount();
  const { createPool, loading: txLoading } = useRWAPoolFactory();
  const { showToast } = useToast();

  const handleCreatePool = async () => {
    if (!rwaToken || !verifier || !imageId) return;
    
    try {
      const result = await createPool(CONTRACT_ADDRESSES.mUSD, rwaToken, verifier, imageId);
      if (result.txHash) {
        showToast(`Pool created successfully! Hash: ${result.txHash.slice(0, 10)}...`, 'success');
        setRwaToken('');
        setVerifier('');
        setImageId('');
        setShowCreateForm(false);
        // Wait for subgraph to index the transaction before refetching
        setTimeout(() => {
          refetch();
          onTransactionComplete?.();
        }, 3000);
      }
    } catch (error) {
      showToast((error as Error).message || 'Pool creation failed', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Pool Factory & Management</h3>
          <button 
            className="btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={txLoading}
          >
            {showCreateForm ? 'Cancel' : 'Create Pool'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-3" style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
          <h4 className="mb-2">Create New Pool</h4>
          <div className="grid grid-2">
            <div className="input-group">
              <label>RWA Token Address</label>
              <input 
                type="text" 
                placeholder="0x..." 
                value={rwaToken}
                onChange={(e) => setRwaToken(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Verifier Address</label>
              <input 
                type="text" 
                placeholder="0x..." 
                value={verifier}
                onChange={(e) => setVerifier(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Image ID</label>
              <input 
                type="text" 
                placeholder="0x..." 
                value={imageId}
                onChange={(e) => setImageId(e.target.value)}
              />
            </div>
          </div>
          <button 
            className="btn-primary" 
            onClick={handleCreatePool}
            disabled={!rwaToken || !verifier || !imageId || !address || txLoading}
          >
            {txLoading ? 'Processing...' : 'Deploy Pool'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading pools...</div>
      ) : (
        <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>mUSD Reserve</th>
                <th>RWA Reserve</th>
                <th>Liquidity</th>
                <th>Volume</th>
                <th>Swaps</th>
                <th>Verifier</th>
              </tr>
            </thead>
            <tbody>
              {data?.rwapools?.map((pool: { id: string; assetSymbol: string; reserveMUSD: string; reserveRWA: string; totalLiquidity: string; totalVolume: string; totalSwaps: string; verifier: string }) => (
                <tr key={pool.id}>
                  <td>{pool.assetSymbol}</td>
                  <td>{formatMUSD(pool.reserveMUSD)} mUSD</td>
                  <td>{formatToken(pool.reserveRWA)}</td>
                  <td>{formatToken(pool.totalLiquidity)}</td>
                  <td>{formatMUSD(pool.totalVolume)} mUSD</td>
                  <td>{pool.totalSwaps}</td>
                  <td className="text-xs">{pool.verifier?.slice(0, 10)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
