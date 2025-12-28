'use client';

import { useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { formatBigInt, formatAddress } from '@/utils/format';
import { useMUSD } from '@/hooks/useMUSD';
import { useERC20 } from '@/hooks/useERC20';
import { useToast } from '@/components/Toast';

const GET_ALL_USERS = gql`
  query GetAllUsers {
    users(first: 100, orderBy: debtBalance, orderDirection: desc) {
      id
      address
      musdBalance
      debtBalance
      collateralBalance
      healthFactor
    }
  }
`;

interface MUSDAdminPanelProps {
  onTransactionComplete?: () => void;
}

export function MUSDAdminPanel({ onTransactionComplete }: MUSDAdminPanelProps) {
  const { data, loading, refetch } = useQuery(GET_ALL_USERS);
  const { liquidate, loading: musdLoading } = useMUSD();
  const { showToast } = useToast();
  const [showMintForm, setShowMintForm] = useState(false);
  const [showBurnForm, setShowBurnForm] = useState(false);
  const [targetAddress, setTargetAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('mETH');

  const ASSETS = [
    { name: 'mETH', address: '0xdd37c9e2237506273f86da1272ca51470df6e8ae' },
    { name: 'Gold', address: '0x4ABD994Dd8e6581d909A6AcEf82e453d3E141d65' },
    { name: 'Real Estate Share', address: '0x7e086BeC259f8A7c02B4324e9e2dA149b4cD3784' },
    { name: 'Money Market Share', address: '0x7e086BeC259f8A7c02B4324e9e2dA149b4cD3784' },
  ];

  const selectedAssetAddress = ASSETS.find(a => a.name === selectedAsset)?.address || ASSETS[0].address;
  const { mint, burn, loading: tokenLoading } = useERC20(selectedAssetAddress);
  const txLoading = musdLoading || tokenLoading;

  const handleLiquidate = async (userAddress: string) => {
    try {
      const txHash = await liquidate(userAddress);
      showToast(`Liquidation confirmed! Hash: ${txHash.slice(0, 10)}...`, 'success');
      // Wait for subgraph to index the transaction before refetching
      setTimeout(() => {
        refetch();
        onTransactionComplete?.();
      }, 3000);
    } catch (error: any) {
      showToast(error.message || 'Liquidation failed', 'error');
    }
  };

  const handleMint = async () => {
    if (!targetAddress || !amount) return;
    try {
      const txHash = await mint(targetAddress, amount);
      showToast(`${selectedAsset} minted! Hash: ${txHash.slice(0, 10)}...`, 'success');
      setTargetAddress('');
      setAmount('');
      setShowMintForm(false);
      setTimeout(() => {
        refetch();
        onTransactionComplete?.();
      }, 3000);
    } catch (error: any) {
      showToast(error.message || 'Mint failed', 'error');
    }
  };

  const handleBurn = async () => {
    if (!targetAddress || !amount) return;
    try {
      const txHash = await burn(targetAddress, amount);
      showToast(`${selectedAsset} burned! Hash: ${txHash.slice(0, 10)}...`, 'success');
      setTargetAddress('');
      setAmount('');
      setShowBurnForm(false);
      setTimeout(() => {
        refetch();
        onTransactionComplete?.();
      }, 3000);
    } catch (error: any) {
      showToast(error.message || 'Burn failed', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>mUSD Monitoring & Liquidation</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-sm btn-primary" onClick={() => setShowMintForm(!showMintForm)}>
              {showMintForm ? 'Cancel' : 'Mint Asset'}
            </button>
            <button className="btn-sm btn-primary" onClick={() => setShowBurnForm(!showBurnForm)}>
              {showBurnForm ? 'Cancel' : 'Burn Asset'}
            </button>
          </div>
        </div>
      </div>

      {showMintForm && (
        <div className="mb-3" style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
          <h4 className="mb-2">Mint Asset</h4>
          <div className="input-group mb-2">
            <label>Asset</label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            >
              {ASSETS.map((asset) => (
                <option key={asset.name} value={asset.name}>
                  {asset.name}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group mb-2">
            <label>Target Address</label>
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="0x..."
            />
          </div>
          <div className="input-group mb-2">
            <label>Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
            />
          </div>
          <button className="btn-primary" onClick={handleMint} disabled={!targetAddress || !amount || txLoading}>
            {txLoading ? 'Processing...' : 'Mint'}
          </button>
        </div>
      )}

      {showBurnForm && (
        <div className="mb-3" style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
          <h4 className="mb-2">Burn Asset</h4>
          <div className="input-group mb-2">
            <label>Asset</label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            >
              {ASSETS.map((asset) => (
                <option key={asset.name} value={asset.name}>
                  {asset.name}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group mb-2">
            <label>Target Address</label>
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="0x..."
            />
          </div>
          <div className="input-group mb-2">
            <label>Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
            />
          </div>
          <button className="btn-primary" onClick={handleBurn} disabled={!targetAddress || !amount || txLoading}>
            {txLoading ? 'Processing...' : 'Burn'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>mUSD Balance</th>
                <th>Debt</th>
                <th>Collateral</th>
                <th>Health Factor</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.users?.map((user: any) => {
                const healthFactor = parseFloat(user.healthFactor);
                const isLiquidatable = healthFactor < 1.5;
                
                return (
                  <tr key={user.id}>
                    <td>{formatAddress(user.address)}</td>
                    <td>{formatBigInt(user.musdBalance)} mUSD</td>
                    <td>{formatBigInt(user.debtBalance)} mUSD</td>
                    <td>{formatBigInt(user.collateralBalance)} mETH</td>
                    <td>
                      <span className={healthFactor < 1.5 ? 'badge badge-danger' : healthFactor < 2 ? 'badge badge-warning' : 'badge badge-success'}>
                        {healthFactor.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      {isLiquidatable ? (
                        <span className="badge badge-danger">Liquidatable</span>
                      ) : (
                        <span className="badge badge-success">Healthy</span>
                      )}
                    </td>
                    <td>
                      {isLiquidatable && (
                        <button 
                          className="btn-sm btn-outline"
                          onClick={() => handleLiquidate(user.address)}
                          disabled={txLoading}
                        >
                          {txLoading ? 'Processing...' : 'Liquidate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
