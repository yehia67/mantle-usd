'use client';

import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { gql, useQuery } from '@apollo/client';
import { formatBigInt } from '@/utils/format';
import { useSuperStake } from '@/hooks/useSuperStake';
import { useToast } from '@/components/Toast';

const GET_SUPERSTAKE_POSITION = gql`
  query GetSuperStakePosition($userId: ID!) {
    superStakePosition(id: $userId) {
      id
      user
      collateralLocked
      totalDebtMinted
      loops
      active
    }
  }
`;

export function SuperStakeUserPanel() {
  const { address } = useAppKitAccount();
  const [amount, setAmount] = useState('');
  const [loops, setLoops] = useState('1');
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit');
  const { showToast } = useToast();
  
  const { data, loading, refetch } = useQuery(GET_SUPERSTAKE_POSITION, {
    variables: { userId: address?.toLowerCase() },
    skip: !address,
  });

  const { deposit, withdraw, loading: txLoading } = useSuperStake();

  const handleAction = async () => {
    try {
      let txHash;
      if (action === 'deposit') {
        txHash = await deposit(amount, parseInt(loops));
      } else if (action === 'withdraw') {
        txHash = await withdraw(amount);
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

  const position = data?.superStakePosition;

  return (
    <div className="card">
      <div className="card-header">
        <h3>Super Stake</h3>
        {position?.active && <span className="badge badge-success">Active</span>}
      </div>

      {position?.active && (
        <div className="grid grid-2 mb-3">
          <div>
            <p className="text-xs text-secondary">Collateral Locked</p>
            <p className="text-sm">{formatBigInt(position.collateralLocked)} mETH</p>
          </div>
          <div>
            <p className="text-xs text-secondary">Total Debt</p>
            <p className="text-sm">{formatBigInt(position.totalDebtMinted)} mUSD</p>
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="tabs">
          <div className={`tab ${action === 'deposit' ? 'active' : ''}`} onClick={() => setAction('deposit')}>
            Deposit
          </div>
          <div className={`tab ${action === 'withdraw' ? 'active' : ''}`} onClick={() => setAction('withdraw')}>
            Withdraw
          </div>
        </div>
      </div>

      <div className="input-group">
        <label>Amount (mETH)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
        />
      </div>

      {action === 'deposit' && (
        <div className="input-group">
          <label>Leverage Loops (1-3)</label>
          <input
            type="number"
            value={loops}
            onChange={(e) => setLoops(e.target.value)}
            min="1"
            max="3"
            placeholder="1"
          />
        </div>
      )}

      <button className="btn-primary" onClick={handleAction} disabled={!amount || !address || txLoading}>
        {txLoading ? 'Processing...' : action.charAt(0).toUpperCase() + action.slice(1)}
      </button>
    </div>
  );
}
