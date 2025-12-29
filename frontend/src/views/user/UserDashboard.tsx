'use client';

import { useState, useEffect } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { gql, useQuery } from '@apollo/client';
import { StatCard } from '@/components/StatCard';
import { formatMUSD, formatToken } from '@/utils/format';
import { useContract } from '@/hooks/useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import ERC20_ABI from '@/abis/ERC20.json';

const GET_USER_DATA = gql`
  query GetUserData($id: ID!) {
    user(id: $id) {
      id
      musdBalance
      debtBalance
      collateralBalance
      healthFactor
    }
    protocolStats(id: "protocol") {
      totalSupply
      totalDebt
      totalCollateral
    }
  }
`;

const GET_PROTOCOL_STATS = gql`
  query GetProtocolStats {
    protocolStats(id: "protocol") {
      totalSupply
      totalDebt
      totalCollateral
    }
  }
`;

export function UserDashboard() {
  const { address } = useAppKitAccount();
  const { data, loading, error } = useQuery(address ? GET_USER_DATA : GET_PROTOCOL_STATS, {
    variables: address ? { id: address.toLowerCase() } : undefined,
  });
  
  const mETHContract = useContract(CONTRACT_ADDRESSES.mETH, ERC20_ABI);
  const musdContract = useContract(CONTRACT_ADDRESSES.mUSD, ERC20_ABI);
  const [mETHBalance, setMETHBalance] = useState<string>('0');
  const [musdWalletBalance, setMusdWalletBalance] = useState<string>('0');
  const [balancesLoading, setBalancesLoading] = useState(true);

  useEffect(() => {
    async function fetchBalances() {
      if (!address || !mETHContract || !musdContract) {
        setBalancesLoading(false);
        return;
      }
      
      try {
        setBalancesLoading(true);
        const [methBal, musdBal] = await Promise.all([
          mETHContract.read.balanceOf(address),
          musdContract.read.balanceOf(address)
        ]);
        setMETHBalance(methBal.toString());
        setMusdWalletBalance(musdBal.toString());
      } catch (err) {
        console.error('Error fetching balances:', err);
      } finally {
        setBalancesLoading(false);
      }
    }
    
    fetchBalances();
  }, [address, mETHContract, musdContract]);

  const protocolStats = data?.protocolStats;

  if (!address) {
    return (
      <div>
        <h2 className="mb-3">Protocol Overview</h2>
        <div className="card mb-3" style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
          <p className="text-secondary" style={{ margin: 0 }}>
            ℹ️ Connect your wallet to view your personal dashboard and interact with the protocol
          </p>
        </div>
        {protocolStats && (
          <div className="grid grid-3">
            <StatCard 
              label="Total Supply" 
              value={formatMUSD(protocolStats.totalSupply || '0')} 
              suffix="mUSD"
            />
            <StatCard 
              label="Total Debt" 
              value={formatMUSD(protocolStats.totalDebt || '0')} 
              suffix="mUSD"
            />
            <StatCard 
              label="Total Collateral" 
              value={formatToken(protocolStats.totalCollateral || '0')} 
              suffix="mETH"
            />
          </div>
        )}
      </div>
    );
  }

  if (loading || balancesLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error loading data: {error.message}</div>;

  const user = data?.user;
  const hasNoCollateral = !user || (user.collateralBalance === '0' && user.debtBalance === '0');

  return (
    <div>
      <h2 className="mb-3">Your Dashboard</h2>
      
      {hasNoCollateral && (
        <div className="card mb-3" style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
          <p className="text-secondary" style={{ margin: 0 }}>
            ℹ️ This wallet has not locked any collateral yet. Lock mETH collateral to mint mUSD.
          </p>
        </div>
      )}
      
      <div className="grid grid-4">
        <StatCard 
          label="Available mETH" 
          value={formatToken(mETHBalance)} 
          suffix="mETH"
        />
        <StatCard 
          label="Available mUSD" 
          value={formatMUSD(musdWalletBalance)} 
          suffix="mUSD"
        />
        <StatCard 
          label="Locked Collateral" 
          value={formatToken(user?.collateralBalance || '0')} 
          suffix="mETH"
        />
        <StatCard 
          label="Debt" 
          value={formatMUSD(user?.debtBalance || '0')} 
          suffix="mUSD"
        />
      </div>
      
      {!hasNoCollateral && (
        <div className="grid grid-2 mt-3">
          <StatCard 
            label="Health Factor" 
            value={user?.healthFactor ? `${(parseFloat(user.healthFactor) / 100).toFixed(2)}` : 'N/A'}
          />
        </div>
      )}
    </div>
  );
}
