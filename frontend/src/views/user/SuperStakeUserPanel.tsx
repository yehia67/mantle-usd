'use client';

import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { gql, useQuery } from '@apollo/client';
import { formatMUSD, formatToken } from '@/utils/format';
import { useSuperStake } from '@/hooks/useSuperStake';
import { useToast } from '@/components/Toast';

const GET_SUPERSTAKE_POSITION = gql`
  query GetSuperStakePosition($userId: ID!) {
    user(id: $userId) {
      id
      address
      superstakePosition {
        id
        collateralLocked
        totalDebtMinted
        loops
        active
      }
      superstakeHistory(orderBy: timestamp, orderDirection: desc, first: 10) {
        id
        collateralAmount
        debtAmount
        deltaCollateral
        deltaDebt
        eventType
        loops
        timestamp
      }
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

  const position = data?.user?.superstakePosition;
  const history = data?.user?.superstakeHistory || [];

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
            <p className="text-sm">{formatToken(position.collateralLocked)} mETH</p>
          </div>
          <div>
            <p className="text-xs text-secondary">Total Debt</p>
            <p className="text-sm">{formatMUSD(position.totalDebtMinted)} mUSD</p>
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
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            style={{ paddingRight: action === 'withdraw' && position?.active ? '60px' : undefined }}
          />
          {action === 'withdraw' && position?.active && (
            <button 
              onClick={() => setAmount(formatToken(position.collateralLocked, 18))}
              type="button"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#6366f1',
                background: 'transparent',
                border: '1px solid #6366f1',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#6366f1';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#6366f1';
              }}
            >
              MAX
            </button>
          )}
        </div>
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

      {history.length > 0 && (
        <>
          <h4 className="mb-2 mt-4">Position History</h4>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Collateral</th>
                  <th>Debt</th>
                  <th>Loops</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry: any) => (
                  <tr key={entry.id}>
                    <td>
                      <span className={`badge ${
                        entry.eventType === 'OPEN' ? 'badge-success' : 
                        entry.eventType === 'CLOSE' ? 'badge-danger' : 
                        entry.eventType === 'DEPOSIT' ? 'badge-info' : 
                        'badge-warning'
                      }`}>
                        {entry.eventType}
                      </span>
                    </td>
                    <td>
                      {formatToken(entry.collateralAmount)} mETH
                      <span className="text-xs text-secondary ml-1">
                        ({entry.deltaCollateral >= 0 ? '+' : ''}{formatToken(entry.deltaCollateral)})
                      </span>
                    </td>
                    <td>
                      {formatMUSD(entry.debtAmount)} mUSD
                      <span className="text-xs text-secondary ml-1">
                        ({entry.deltaDebt >= 0 ? '+' : ''}{formatMUSD(entry.deltaDebt)})
                      </span>
                    </td>
                    <td>{entry.loops}x</td>
                    <td className="text-xs">
                      {new Date(parseInt(entry.timestamp) * 1000).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
