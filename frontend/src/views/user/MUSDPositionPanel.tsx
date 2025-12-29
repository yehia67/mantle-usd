'use client';

import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { gql, useQuery } from '@apollo/client';
import { formatMUSD, formatToken } from '@/utils/format';
import { useMUSD } from '@/hooks/useMUSD';
import { useToast } from '@/components/Toast';

const GET_MUSD_POSITIONS = gql`
  query GetMUSDPositions($userId: ID!) {
    user(id: $userId) {
      id
      address
      musdBalance
      debtBalance
      collateralBalance
      healthFactor
      musdPositions(orderBy: lastUpdatedTimestamp, orderDirection: desc) {
        id
        collateralAmount
        debtAmount
        deltaCollateral
        deltaDebt
        eventType
        healthFactor
        lastUpdatedTimestamp
      }
    }
  }
`;

export function MUSDPositionPanel() {
  const { address } = useAppKitAccount();
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'lock' | 'unlock'>('lock');
  const { showToast } = useToast();
  
  const { data, loading, refetch } = useQuery(GET_MUSD_POSITIONS, {
    variables: { userId: address?.toLowerCase() },
    skip: !address,
  });

  const { lockCollateral, unlockCollateral, checkApproval, approveMETH, needsApproval, loading: txLoading } = useMUSD();

  const handleAmountChange = async (value: string) => {
    setAmount(value);
    if (action === 'lock' && value) {
      await checkApproval(value);
    }
  };

  const handleApprove = async () => {
    try {
      const txHash = await approveMETH();
      showToast(`Approval confirmed! Hash: ${txHash.slice(0, 10)}...`, 'success');
    } catch (error) {
      showToast((error as Error).message || 'Approval failed', 'error');
    }
  };

  const handleAction = async () => {
    try {
      let txHash;
      if (action === 'lock') {
        txHash = await lockCollateral(amount);
      } else if (action === 'unlock') {
        txHash = await unlockCollateral(amount);
      }
      
      if (txHash) {
        showToast(`Transaction confirmed! Hash: ${txHash.slice(0, 10)}...`, 'success');
        setAmount('');
        setTimeout(() => refetch(), 3000);
      }
    } catch (error) {
      showToast((error as Error).message || 'Transaction failed', 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>mUSD Position</h3>
      </div>

      <div className="mb-3">
        <div className="tabs">
          <div className={`tab ${action === 'lock' ? 'active' : ''}`} onClick={() => setAction('lock')}>
            Lock Collateral
          </div>
          <div className={`tab ${action === 'unlock' ? 'active' : ''}`} onClick={() => setAction('unlock')}>
            Unlock Collateral
          </div>
        </div>
      </div>

      <div className="input-group">
        <label>Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="0.0"
        />
      </div>

      {action === 'lock' && needsApproval ? (
        <button className="btn-primary" onClick={handleApprove} disabled={!amount || !address || txLoading}>
          {txLoading ? 'Approving...' : 'Approve mETH'}
        </button>
      ) : (
        <button className="btn-primary" onClick={handleAction} disabled={!amount || !address || txLoading}>
          {txLoading ? 'Processing...' : action.charAt(0).toUpperCase() + action.slice(1)}
        </button>
      )}

      <div className="mt-3">
        <h4 className="mb-2">Current Position</h4>
        <div className="grid grid-3 mb-3">
          <div>
            <p className="text-xs text-secondary">Collateral</p>
            <p className="text-sm">{formatToken(data?.user?.collateralBalance || '0')} mETH</p>
          </div>
          <div>
            <p className="text-xs text-secondary">Debt</p>
            <p className="text-sm">{formatMUSD(data?.user?.debtBalance || '0')} mUSD</p>
          </div>
          <div>
            <p className="text-xs text-secondary">Health Factor</p>
            <p className="text-sm">{data?.user?.healthFactor ? (parseFloat(data.user.healthFactor) / 100).toFixed(2) : '0.00'}</p>
          </div>
        </div>
        
        {data?.user?.musdPositions?.length > 0 && (
          <>
            <h4 className="mb-2">Position History</h4>
            <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Collateral</th>
                    <th>Debt</th>
                    <th>Health Factor</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.user.musdPositions.map((position: { id: string; eventType: string; collateralAmount: string; debtAmount: string; healthFactor: string; lastUpdatedTimestamp: string }) => (
                    <tr key={position.id}>
                      <td>{position.eventType}</td>
                      <td>{formatToken(position.collateralAmount)} mETH</td>
                      <td>{formatMUSD(position.debtAmount)} mUSD</td>
                      <td>{(parseFloat(position.healthFactor) / 100).toFixed(2)}</td>
                      <td>{new Date(parseInt(position.lastUpdatedTimestamp) * 1000).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
