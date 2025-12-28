'use client';

import { StatCard } from '@/components/StatCard';
import { formatMUSD, formatToken } from '@/utils/format';

interface AdminDashboardProps {
  data: {
    users?: Array<{
      id: string;
      musdBalance: string;
      debtBalance: string;
      collateralBalance: string;
      superstakePosition?: unknown;
      liquidityPositions?: unknown[];
    }>;
    rwapools?: Array<{
      id: string;
      totalVolume: string;
      totalSwaps: string;
    }>;
    musdPositions?: Array<{
      id: string;
      eventType: string;
      collateralAmount: string;
      deltaCollateral: string;
      lastUpdatedTimestamp: string;
    }>;
  };
  loading: boolean;
  error: Error | undefined;
}

export function AdminDashboard({ data, loading, error }: AdminDashboardProps) {
  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error loading data: {error.message}</div>;

  // Calculate totals from actual user data
  const users = data?.users || [];
  const pools = data?.rwapools || [];
  
  const totalSupply = users.reduce((sum: bigint, user) => 
    sum + BigInt(user.musdBalance || '0'), BigInt(0)
  );
  
  const totalDebt = users.reduce((sum: bigint, user) => 
    sum + BigInt(user.debtBalance || '0'), BigInt(0)
  );
  
  const totalCollateral = users.reduce((sum: bigint, user) => 
    sum + BigInt(user.collateralBalance || '0'), BigInt(0)
  );
  
  const activeUsers = users.filter((user) => 
    BigInt(user.collateralBalance || '0') > BigInt(0) || 
    BigInt(user.debtBalance || '0') > BigInt(0)
  ).length;
  
  const totalVolume = pools.reduce((sum: bigint, pool) => 
    sum + BigInt(pool.totalVolume || '0'), BigInt(0)
  );
  
  const totalSwaps = pools.reduce((sum: number, pool) => 
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

      <div className="card mt-3">
        <div className="card-header">
          <h4>Collateral Activity Timeline</h4>
        </div>
        <div className="card-body">
          {data?.musdPositions && data.musdPositions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.musdPositions.slice(0, 10).map((position, index: number) => {
                const isLock = position.eventType === 'LOCK' || position.eventType === 'LIQUIDATE';
                const deltaValue = Number(position.deltaCollateral) / 1e18;
                const totalValue = Number(position.collateralAmount) / 1e18;
                
                return (
                  <div 
                    key={position.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: index % 2 === 0 ? '#1f293710' : 'transparent',
                      borderRadius: '6px',
                      borderLeft: `3px solid ${isLock ? '#34d399' : '#f87171'}`
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: isLock ? 'linear-gradient(135deg, #34d399, #10b981)' : 'linear-gradient(135deg, #f87171, #ef4444)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      color: 'white',
                      flexShrink: 0
                    }}>
                      {isLock ? '↑' : '↓'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: isLock ? '#34d399' : '#f87171'
                        }}>
                          {position.eventType}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {new Date(parseInt(position.lastUpdatedTimestamp) * 1000).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <span style={{ color: isLock ? '#34d399' : '#f87171', fontWeight: '600' }}>
                          {isLock ? '+' : ''}{deltaValue.toFixed(4)} mETH
                        </span>
                        <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                          → Total: {totalValue.toFixed(4)} mETH
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-secondary text-sm">No collateral activity yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
