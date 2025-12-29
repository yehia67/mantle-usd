'use client';

import { useState, useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';
import { formatMUSD, formatToken, formatAddress } from '@/utils/format';
import { useMUSD } from '@/hooks/useMUSD';
import { useERC20 } from '@/hooks/useERC20';
import { useToast } from '@/components/Toast';
import { ASSETS } from '@/config/constants';

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
  const { liquidate, setCollateralPrice, getHealthFactor, isLiquidatable, loading: musdLoading } = useMUSD();
  const [userHealthFactors, setUserHealthFactors] = useState<Record<string, number>>({});
  const [userLiquidatable, setUserLiquidatable] = useState<Record<string, boolean>>({});
  const { showToast } = useToast();
  const [showMintForm, setShowMintForm] = useState(false);
  const [showBurnForm, setShowBurnForm] = useState(false);
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [targetAddress, setTargetAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [collateralPrice, setCollateralPriceInput] = useState('2000');
  const [selectedAsset, setSelectedAsset] = useState('mETH');


  const selectedAssetAddress = ASSETS.find(a => a.name === selectedAsset)?.address || ASSETS[0].address;
  const { mint, burn, loading: tokenLoading } = useERC20(selectedAssetAddress);
  const txLoading = musdLoading || tokenLoading;

  // Fetch real-time health factors and liquidatable status from contract
  useEffect(() => {
    const fetchUserData = async () => {
      if (!data?.users) return;
      
      const healthFactors: Record<string, number> = {};
      const liquidatableStatus: Record<string, boolean> = {};
      
      for (const user of data.users) {
        try {
          const [hf, isLiq] = await Promise.all([
            getHealthFactor(user.address),
            isLiquidatable(user.address)
          ]);
          healthFactors[user.address] = hf;
          liquidatableStatus[user.address] = isLiq;
        } catch (error) {
          console.error(`Error fetching data for ${user.address}:`, error);
        }
      }
      
      setUserHealthFactors(healthFactors);
      setUserLiquidatable(liquidatableStatus);
    };
    
    fetchUserData();
  }, [data?.users, getHealthFactor, isLiquidatable]);

  const handleLiquidate = async (userAddress: string) => {
    try {
      const txHash = await liquidate(userAddress);
      showToast(`Liquidation confirmed! Hash: ${txHash.slice(0, 10)}...`, 'success');
      // Wait for subgraph to index the transaction before refetching
      setTimeout(() => {
        refetch();
        onTransactionComplete?.();
      }, 3000);
    } catch (error) {
      showToast((error as Error).message || 'Liquidation failed', 'error');
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
    } catch (error) {
      showToast((error as Error).message || 'Mint failed', 'error');
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
    } catch (error) {
      showToast((error as Error).message || 'Burn failed', 'error');
    }
  };

  const handleSetPrice = async () => {
    if (!collateralPrice) return;
    try {
      const txHash = await setCollateralPrice(collateralPrice);
      showToast(`Collateral price set to $${collateralPrice}! Hash: ${txHash.slice(0, 10)}...`, 'success');
      setShowPriceForm(false);
      setTimeout(() => {
        refetch();
        onTransactionComplete?.();
      }, 3000);
    } catch (error) {
      showToast((error as Error).message || 'Price update failed', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>mUSD Monitoring & Liquidation</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-sm btn-primary" onClick={() => setShowPriceForm(!showPriceForm)}>
              {showPriceForm ? 'Cancel' : 'Set Price'}
            </button>
            <button className="btn-sm btn-primary" onClick={() => setShowMintForm(!showMintForm)}>
              {showMintForm ? 'Cancel' : 'Mint Asset'}
            </button>
            <button className="btn-sm btn-primary" onClick={() => setShowBurnForm(!showBurnForm)}>
              {showBurnForm ? 'Cancel' : 'Burn Asset'}
            </button>
          </div>
        </div>
      </div>

      {showPriceForm && (
        <div className="mb-3" style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
          <h4 className="mb-2">Set Collateral Price (mETH)</h4>
          <p className="text-sm text-secondary mb-2">Set the USD price of mETH collateral (affects liquidation thresholds)</p>
          <div className="input-group mb-2">
            <label>Price in USD</label>
            <input
              type="number"
              value={collateralPrice}
              onChange={(e) => setCollateralPriceInput(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={handleSetPrice} disabled={!collateralPrice || txLoading}>
            {txLoading ? 'Processing...' : 'Set Price'}
          </button>
        </div>
      )}

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
              {data?.users?.map((user: { id: string; address: string; musdBalance: string; debtBalance: string; collateralBalance: string; healthFactor: string }) => {
                // Use real-time data from contract, fallback to cached subgraph data
                const healthFactor = userHealthFactors[user.address] ?? (parseFloat(user.healthFactor) / 100);
                const isLiquidatableNow = userLiquidatable[user.address] ?? false;
                
                // Check if position is liquidated (no debt and no collateral)
                const debt = parseFloat(user.debtBalance);
                const collateral = parseFloat(user.collateralBalance);
                const isLiquidated = debt === 0 && collateral === 0;
                
                return (
                  <tr key={user.id}>
                    <td>{formatAddress(user.address)}</td>
                    <td>{formatMUSD(user.musdBalance)} mUSD</td>
                    <td>{formatMUSD(user.debtBalance)} mUSD</td>
                    <td>{formatToken(user.collateralBalance)} mETH</td>
                    <td>
                      {isLiquidated ? (
                        <span className="badge badge-secondary">Liquidated</span>
                      ) : (
                        <span className={healthFactor < 1.5 ? 'badge badge-danger' : healthFactor < 2 ? 'badge badge-warning' : 'badge badge-success'}>
                          {healthFactor.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td>
                      {isLiquidated ? (
                        <span className="badge badge-secondary">Liquidated</span>
                      ) : isLiquidatableNow ? (
                        <span className="badge badge-danger">Liquidatable</span>
                      ) : (
                        <span className="badge badge-success">Healthy</span>
                      )}
                    </td>
                    <td>
                      {isLiquidatableNow && (
                        <button 
                          className="btn-sm btn-danger" 
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
