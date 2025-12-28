'use client';

import { StatCard } from '@/components/StatCard';
import { formatMUSD, formatToken } from '@/utils/format';

interface AdminDashboardProps {
  data: any;
  loading: boolean;
  error: any;
}

export function AdminDashboard({ data, loading, error }: AdminDashboardProps) {
  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error loading data: {error.message}</div>;

  // Calculate totals from actual user data
  const users = data?.users || [];
  const pools = data?.rwapools || [];
  
  const totalSupply = users.reduce((sum: bigint, user: any) => 
    sum + BigInt(user.musdBalance || '0'), BigInt(0)
  );
  
  const totalDebt = users.reduce((sum: bigint, user: any) => 
    sum + BigInt(user.debtBalance || '0'), BigInt(0)
  );
  
  const totalCollateral = users.reduce((sum: bigint, user: any) => 
    sum + BigInt(user.collateralBalance || '0'), BigInt(0)
  );
  
  const activeUsers = users.filter((user: any) => 
    BigInt(user.collateralBalance || '0') > BigInt(0) || 
    BigInt(user.debtBalance || '0') > BigInt(0)
  ).length;
  
  const totalVolume = pools.reduce((sum: bigint, pool: any) => 
    sum + BigInt(pool.totalVolume || '0'), BigInt(0)
  );
  
  const totalSwaps = pools.reduce((sum: number, pool: any) => 
    sum + parseInt(pool.totalSwaps || '0'), 0
  );

  return (
    <div>
      <h2 className="mb-3">Protocol Overview</h2>
      <div className="grid grid-4">
        <StatCard 
          label="Total Supply" 
          value={formatMUSD(totalSupply.toString())} 
          suffix="mUSD"
        />
        <StatCard 
          label="Total Debt" 
          value={formatMUSD(totalDebt.toString())} 
          suffix="mUSD"
        />
        <StatCard 
          label="Total Collateral" 
          value={formatToken(totalCollateral.toString())} 
          suffix="mETH"
        />
        <StatCard 
          label="Active Users" 
          value={activeUsers.toString()}
        />
      </div>
      <div className="grid grid-3 mt-3">
        <StatCard 
          label="Total Pools" 
          value={pools.length.toString()}
        />
        <StatCard 
          label="Total Volume" 
          value={formatMUSD(totalVolume.toString())} 
          suffix="mUSD"
        />
        <StatCard 
          label="Total Swaps" 
          value={totalSwaps.toString()}
        />
      </div>
    </div>
  );
}
