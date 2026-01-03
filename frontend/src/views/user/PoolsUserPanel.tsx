'use client';

import { useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import { formatMUSD, formatToken } from '@/utils/format';
import { useRWAPool } from '@/hooks/useRWAPool';
import { useAppKitAccount } from '@reown/appkit/react';
import { useToast } from '@/components/Toast';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import { ComplianceModal } from '@/components/ComplianceModal';

const GET_POOLS = gql`
  query GetPools {
    rwapools {
      id
      rwaToken
      assetSymbol
      reserveMUSD
      reserveRWA
      totalLiquidity
      totalVolume
      totalSwaps
    }
  }
`;

interface ComplianceProof {
  seal: string;
  imageId: string;
  journalDigest: string;
  outcome: {
    allowed: boolean;
    reason: string;
    max_allocation: number;
  };
}

export function PoolsUserPanel() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [amountMUSD, setAmountMUSD] = useState('');
  const [amountRWA, setAmountRWA] = useState('');
  const [swapDirection, setSwapDirection] = useState<'mUSDtoRWA' | 'RWAtoMUSD'>('mUSDtoRWA');
  const [action, setAction] = useState<'addLiquidity' | 'swap'>('addLiquidity');
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [complianceProof, setComplianceProof] = useState<ComplianceProof | null>(null);
  const { data, loading, refetch } = useQuery(GET_POOLS);
  const { address } = useAppKitAccount();
  const { showToast } = useToast();
  
  const selectedPoolData = data?.rwapools?.find((p: any) => p.id === selectedPool);
  const rwaTokenAddress = selectedPoolData?.rwaToken; // Get actual RWA token address from subgraph
  
  const { 
    addLiquidity, 
    swap, 
    checkSwapApproval,
    checkLiquidityApproval,
    approveSwapToken,
    approveMUSD,
    approveRWA,
    needsApprovalMUSD,
    needsApprovalRWA,
    loading: swapLoading 
  } = useRWAPool(selectedPool || '', rwaTokenAddress);

  const calculateComplementaryAmount = (inputAmount: string, isMusdInput: boolean) => {
    if (!selectedPoolData || !inputAmount || inputAmount === '0') return '';
    
    // Reserves from subgraph are in wei (with decimals)
    // mUSD has 6 decimals, RWA tokens have 18 decimals
    const reserveMUSD = parseFloat(selectedPoolData.reserveMUSD) / 1e6; // Convert from 6 decimals
    const reserveRWA = parseFloat(selectedPoolData.reserveRWA) / 1e18; // Convert from 18 decimals
    
    if (reserveMUSD === 0 || reserveRWA === 0) return '';
    
    const input = parseFloat(inputAmount);
    if (isNaN(input)) return '';
    
    let result: number;
    if (isMusdInput) {
      // User enters mUSD, calculate RWA: RWA = (mUSD * reserveRWA) / reserveMUSD
      result = (input * reserveRWA) / reserveMUSD;
      // Round to 18 decimals max for RWA tokens
      return Number(result.toFixed(18)).toString();
    } else {
      // User enters RWA, calculate mUSD: mUSD = (RWA * reserveMUSD) / reserveRWA
      result = (input * reserveMUSD) / reserveRWA;
      // Round to 6 decimals max for mUSD
      return Number(result.toFixed(6)).toString();
    }
  };

  const handleMUSDChange = async (value: string) => {
    setAmountMUSD(value);
    const calculatedRWA = calculateComplementaryAmount(value, true);
    setAmountRWA(calculatedRWA);
    
    if (value && calculatedRWA) {
      await checkLiquidityApproval(value, calculatedRWA);
    }
  };

  const handleRWAChange = async (value: string) => {
    setAmountRWA(value);
    const calculatedMUSD = calculateComplementaryAmount(value, false);
    setAmountMUSD(calculatedMUSD);
    
    if (value && calculatedMUSD) {
      await checkLiquidityApproval(calculatedMUSD, value);
    }
  };

  const handleSwapAmountChange = async (value: string) => {
    setAmount(value);
    if (value) {
      const tokenIn = swapDirection === 'mUSDtoRWA' ? CONTRACT_ADDRESSES.mUSD : rwaTokenAddress;
      await checkSwapApproval(tokenIn, value);
    }
  };

  const handleApproveMUSD = async () => {
    try {
      const txHash = await approveMUSD();
      showToast(`mUSD approved! Hash: ${txHash.slice(0, 10)}...`, 'success');
      if (amountMUSD && amountRWA) {
        await checkLiquidityApproval(amountMUSD, amountRWA);
      }
    } catch (error) {
      showToast((error as Error).message || 'Approval failed', 'error');
    }
  };

  const handleApproveRWA = async () => {
    try {
      const txHash = await approveRWA();
      showToast(`${selectedPoolData?.assetSymbol} approved! Hash: ${txHash.slice(0, 10)}...`, 'success');
      if (amountMUSD && amountRWA) {
        await checkLiquidityApproval(amountMUSD, amountRWA);
      }
    } catch (error) {
      showToast((error as Error).message || 'Approval failed', 'error');
    }
  };

  const handleApproveSwap = async () => {
    try {
      const tokenIn = swapDirection === 'mUSDtoRWA' ? CONTRACT_ADDRESSES.mUSD : rwaTokenAddress;
      const txHash = await approveSwapToken(tokenIn);
      const tokenName = swapDirection === 'mUSDtoRWA' ? 'mUSD' : selectedPoolData?.assetSymbol;
      showToast(`${tokenName} approved! Hash: ${txHash.slice(0, 10)}...`, 'success');
    } catch (error) {
      showToast((error as Error).message || 'Approval failed', 'error');
    }
  };

  const handleInitiateSwap = () => {
    if (!amount) {
      showToast('Please enter an amount', 'error');
      return;
    }
    // Open compliance modal before swap
    setShowComplianceModal(true);
  };

  const handleComplianceSuccess = (proof: ComplianceProof) => {
    setComplianceProof(proof);
    // Automatically execute swap after compliance approval
    executeSwap(proof);
  };

  const executeSwap = async (proof: ComplianceProof) => {
    if (!selectedPool || !amount) return;
    
    try {
      const tokenIn = swapDirection === 'mUSDtoRWA' ? CONTRACT_ADDRESSES.mUSD : rwaTokenAddress;
      const tokenOut = swapDirection === 'mUSDtoRWA' ? rwaTokenAddress : CONTRACT_ADDRESSES.mUSD;
      
      const txHash = await swap(
        tokenIn,
        tokenOut,
        amount,
        '0', // minAmountOut = 0 for testing
        proof.seal,
        proof.imageId,
        proof.journalDigest
      );
      
      if (txHash) {
        showToast(`Swap successful! Hash: ${txHash.slice(0, 10)}...`, 'success');
        setAmount('');
        setComplianceProof(null);
        // Wait for subgraph to index the transaction before refetching
        setTimeout(() => refetch(), 3000);
      }
    } catch (error) {
      showToast((error as Error).message || 'Swap failed', 'error');
    }
  };

  const handleAction = async () => {
    if (!selectedPool) return;
    
    try {
      let txHash;
      if (action === 'addLiquidity') {
        if (!amountMUSD || !amountRWA) {
          showToast('Please enter both mUSD and RWA amounts', 'error');
          return;
        }
        txHash = await addLiquidity(amountMUSD, amountRWA, '0');
        
        if (txHash) {
          showToast(`Liquidity added! Hash: ${txHash.slice(0, 10)}...`, 'success');
          setAmountMUSD('');
          setAmountRWA('');
          // Wait for subgraph to index the transaction before refetching
          setTimeout(() => refetch(), 3000);
        }
      }
    } catch (error) {
      showToast((error as Error).message || 'Transaction failed', 'error');
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
        <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
              {data?.rwapools?.map((pool: { id: string; assetSymbol: string; reserveMUSD: string; reserveRWA: string; totalLiquidity: string; totalVolume: string; totalSwaps: string }) => (
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
          <h4>Pool Actions - {selectedPoolData?.assetSymbol}</h4>
          <div className="tabs mb-2">
            <div className={`tab ${action === 'addLiquidity' ? 'active' : ''}`} onClick={() => setAction('addLiquidity')}>
              Add Liquidity
            </div>
            <div className={`tab ${action === 'swap' ? 'active' : ''}`} onClick={() => setAction('swap')}>
              Swap
            </div>
          </div>
          
          {action === 'addLiquidity' ? (
            <>
              <div className="input-group">
                <label>mUSD Amount</label>
                <input
                  type="number"
                  value={amountMUSD}
                  onChange={(e) => handleMUSDChange(e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="input-group">
                <label>{selectedPoolData?.assetSymbol} Amount</label>
                <input
                  type="number"
                  value={amountRWA}
                  onChange={(e) => handleRWAChange(e.target.value)}
                  placeholder="0.0"
                />
              </div>
              
              {needsApprovalMUSD && (
                <button 
                  className="btn-primary mb-2" 
                  onClick={handleApproveMUSD}
                  disabled={!address || swapLoading}
                >
                  {swapLoading ? 'Approving...' : 'Approve mUSD'}
                </button>
              )}
              
              {needsApprovalRWA && (
                <button 
                  className="btn-primary mb-2" 
                  onClick={handleApproveRWA}
                  disabled={!address || swapLoading}
                >
                  {swapLoading ? 'Approving...' : `Approve ${selectedPoolData?.assetSymbol}`}
                </button>
              )}
              
              {!needsApprovalMUSD && !needsApprovalRWA && (
                <button 
                  className="btn-primary" 
                  onClick={handleAction}
                  disabled={!address || swapLoading || !amountMUSD || !amountRWA}
                >
                  {swapLoading ? 'Processing...' : 'Add Liquidity'}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="tabs mb-2">
                <div 
                  className={`tab ${swapDirection === 'mUSDtoRWA' ? 'active' : ''}`} 
                  onClick={() => setSwapDirection('mUSDtoRWA')}
                >
                  mUSD → {selectedPoolData?.assetSymbol}
                </div>
                <div 
                  className={`tab ${swapDirection === 'RWAtoMUSD' ? 'active' : ''}`} 
                  onClick={() => setSwapDirection('RWAtoMUSD')}
                >
                  {selectedPoolData?.assetSymbol} → mUSD
                </div>
              </div>
              <div className="input-group">
                <label>{swapDirection === 'mUSDtoRWA' ? 'mUSD' : selectedPoolData?.assetSymbol} Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => handleSwapAmountChange(e.target.value)}
                  placeholder="0.0"
                />
              </div>
              
              {(swapDirection === 'mUSDtoRWA' ? needsApprovalMUSD : needsApprovalRWA) ? (
                <button 
                  className="btn-primary" 
                  onClick={handleApproveSwap}
                  disabled={!address || swapLoading || !amount}
                >
                  {swapLoading ? 'Approving...' : `Approve ${swapDirection === 'mUSDtoRWA' ? 'mUSD' : selectedPoolData?.assetSymbol}`}
                </button>
              ) : (
                <button 
                  className="btn-primary" 
                  onClick={handleInitiateSwap}
                  disabled={!address || swapLoading || !amount}
                >
                  {swapLoading ? 'Processing...' : 'Swap'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Compliance Modal */}
      {showComplianceModal && selectedPool && (
        <ComplianceModal
          isOpen={showComplianceModal}
          onClose={() => setShowComplianceModal(false)}
          poolId={
            selectedPoolData?.assetSymbol === 'Gold' ? 'gold' :
            selectedPoolData?.assetSymbol === 'Money Market Share' ? 'money_market' :
            selectedPoolData?.assetSymbol === 'Real Estate Share' ? 'real_estate' :
            'gold'
          }
          assetSymbol={selectedPoolData?.assetSymbol || ''}
          swapAmount={amount}
          onComplianceSuccess={handleComplianceSuccess}
        />
      )}
    </div>
  );
}
