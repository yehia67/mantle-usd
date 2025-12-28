'use client';

import { useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { formatMUSD, formatToken } from '@/utils/format';
import { useRWAPool } from '@/hooks/useRWAPool';
import { useAppKitAccount } from '@reown/appkit/react';
import { useToast } from '@/components/Toast';

const GET_POOLS = gql`
  query GetPools {
    rwapools {
      id
      assetSymbol
      reserveMUSD
      reserveRWA
      totalLiquidity
      totalVolume
      totalSwaps
    }
  }
`;

export function PoolsUserPanel() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'addLiquidity' | 'swap'>('addLiquidity');
  const { data, loading, refetch } = useQuery(GET_POOLS);
  const { address } = useAppKitAccount();
  const { showToast } = useToast();
  
  // Use a placeholder address to prevent ENS error when no pool is selected
  const poolAddress = selectedPool || '0x0000000000000000000000000000000000000000';
  const { addLiquidity, swap, loading: txLoading } = useRWAPool(poolAddress);

  const handleAction = async () => {
    if (!selectedPool || !amount) return;
    
    try {
      let txHash;
      if (action === 'addLiquidity') {
        txHash = await addLiquidity(amount, amount, '0');
      } else {
        // For swap, we need more parameters - simplified for now
        showToast('Swap functionality requires ZK proof parameters. Please use the full interface.', 'info');
        return;
      }
      
      if (txHash) {
        showToast(`Transaction confirmed! Hash: ${txHash.slice(0, 10)}...`, 'success');
        setAmount('');
        // Wait for subgraph to index the transaction before refetching
        setTimeout(() => refetch(), 3000);
      }
    } catch (error: any) {
      showToast(error.message || 'Transaction failed', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>RWA Pools</h3>
      </div>

      {loading ? (
        <div className="loading">Loading pools...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>mUSD Reserve</th>
                <th>RWA Reserve</th>
                <th>Total Liquidity</th>
                <th>Volume</th>
                <th>Swaps</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.rwapools?.map((pool: any) => (
                <tr key={pool.id}>
                  <td>{pool.assetSymbol}</td>
                  <td>{formatMUSD(pool.reserveMUSD)} mUSD</td>
                  <td>{formatToken(pool.reserveRWA)}</td>
                  <td>{formatToken(pool.totalLiquidity)}</td>
                  <td>{formatMUSD(pool.totalVolume)} mUSD</td>
                  <td>{pool.totalSwaps}</td>
                  <td>
                    <button 
                      className="btn-sm btn-outline"
                      onClick={() => setSelectedPool(pool.id)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPool && (
        <div className="mt-3">
          <h4>Pool Actions</h4>
          <div className="tabs mb-2">
            <div className={`tab ${action === 'addLiquidity' ? 'active' : ''}`} onClick={() => setAction('addLiquidity')}>
              Add Liquidity
            </div>
            <div className={`tab ${action === 'swap' ? 'active' : ''}`} onClick={() => setAction('swap')}>
              Swap
            </div>
          </div>
          <div className="input-group">
            <label>Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
            />
          </div>
          <button 
            className="btn-primary" 
            onClick={handleAction}
            disabled={!amount || !address || txLoading}
          >
            {txLoading ? 'Processing...' : action === 'addLiquidity' ? 'Add Liquidity' : 'Swap'}
          </button>
        </div>
      )}
    </div>
  );
}
