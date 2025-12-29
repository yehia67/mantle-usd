'use client';

import { gql, useQuery } from '@apollo/client';
import { AdminDashboard } from './admin/AdminDashboard';
import { MUSDAdminPanel } from './admin/MUSDAdminPanel';
import { SuperStakeAdminPanel } from './admin/SuperStakeAdminPanel';
import { PoolsAdminPanel } from './admin/PoolsAdminPanel';

const GET_PROTOCOL_STATS = gql`
  query GetProtocolStats {
    users(first: 1000) {
      id
      musdBalance
      debtBalance
      collateralBalance
    }
    rwapools {
      id
      totalVolume
      totalSwaps
    }
    musdPositions: mUSDPositions(first: 50, orderBy: lastUpdatedTimestamp, orderDirection: desc) {
      id
      eventType
      collateralAmount
      deltaCollateral
      lastUpdatedTimestamp
    }
  }
`;

export function AdminView() {
  const { data, loading, error, refetch } = useQuery(GET_PROTOCOL_STATS);

  return (
    <div className="container">
      <AdminDashboard data={data} loading={loading} error={error} />
      <div className="mt-4">
        <MUSDAdminPanel onTransactionComplete={refetch} />
      </div>
      <div className="mt-4">
        <SuperStakeAdminPanel />
      </div>
      <div className="mt-4">
        <PoolsAdminPanel onTransactionComplete={refetch} />
      </div>
    </div>
  );
}
