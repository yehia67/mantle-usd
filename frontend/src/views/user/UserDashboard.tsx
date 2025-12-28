'use client';

import { useAppKitAccount } from '@reown/appkit/react';
import { gql, useQuery } from '@apollo/client';
import { StatCard } from '@/components/StatCard';
import { formatBigInt } from '@/utils/format';

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

export function UserDashboard() {
  const { address } = useAppKitAccount();
  const { data, loading, error } = useQuery(GET_USER_DATA, {
    variables: { id: address?.toLowerCase() },
    skip: !address,
  });

  if (!address) {
    return (
      <div className="card">
        <p className="text-secondary">Connect wallet to view dashboard</p>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error loading data: {error.message}</div>;

  const user = data?.user;

  return (
    <div>
      <h2 className="mb-3">Your Dashboard</h2>
      <div className="grid grid-4">
        <StatCard 
          label="mUSD Balance" 
          value={formatBigInt(user?.musdBalance || '0')} 
          suffix="mUSD"
        />
        <StatCard 
          label="Debt" 
          value={formatBigInt(user?.debtBalance || '0')} 
          suffix="mUSD"
        />
        <StatCard 
          label="Collateral" 
          value={formatBigInt(user?.collateralBalance || '0')} 
          suffix="mETH"
        />
        <StatCard 
          label="Health Factor" 
          value={user?.healthFactor ? parseFloat(user.healthFactor).toFixed(2) : 'N/A'}
        />
      </div>
    </div>
  );
}
