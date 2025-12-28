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

  const toBaseUnits = (value: bigint, decimals: number) => {
    if (value === BigInt(0)) return 0;
    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = Number(value / divisor);
    const remainder = Number(value % divisor);
    return integerPart + remainder / Number(divisor.toString());
  };

  const collateralChartValue = toBaseUnits(totalCollateral, 18);
  const debtChartValue = toBaseUnits(totalDebt, 6);
  const totalChartValue = collateralChartValue + debtChartValue;
  const collateralPercent = totalChartValue ? (collateralChartValue / totalChartValue) * 100 : 0;
  const debtPercent = totalChartValue ? (debtChartValue / totalChartValue) * 100 : 0;
  const hasChartData = totalChartValue > 0;

  const usersWithMUSD = users.filter((u: any) => BigInt(u.collateralBalance || '0') > BigInt(0)).length;
  const usersWithSuperStake = users.filter((u: any) => u.superstakePosition).length;
  const usersWithLiquidity = users.filter((u: any) => u.liquidityPositions?.length > 0).length;

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

      <div className="grid grid-2 mt-3 gap-3">
        <div className="card">
          <div className="card-header">
            <h4>Collateral vs. Debt</h4>
          </div>
          <div className="card-body">
            {hasChartData ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    height: '14px',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    background: '#1f2937',
                    boxShadow: 'inset 0 0 6px rgba(0,0,0,0.35)',
                  }}
                >
                  <div
                    style={{
                      width: `${collateralPercent}%`,
                      background: 'linear-gradient(90deg, #6ee7b7, #34d399)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                  <div
                    style={{
                      width: `${debtPercent}%`,
                      background: 'linear-gradient(90deg, #fca5a5, #f87171)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div className="grid grid-2 mt-3 text-sm">
                  <div>
                    <p className="text-secondary text-xs">Collateral ({collateralPercent.toFixed(1)}%)</p>
                    <p>{formatToken(totalCollateral.toString())} mETH</p>
                  </div>
                  <div>
                    <p className="text-secondary text-xs">Debt ({debtPercent.toFixed(1)}%)</p>
                    <p>{formatMUSD(totalDebt.toString())} mUSD</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-secondary text-sm">No collateral or debt recorded yet.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h4>Protocol Ecosystem</h4>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                }}>
                  {users.length}
                </div>
                <div style={{ flex: 1 }}>
                  <p className="text-xs text-secondary">Total Users</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '11px' }}>
                    <span style={{ padding: '2px 6px', background: '#34d39920', color: '#34d399', borderRadius: '4px' }}>
                      {usersWithMUSD} mUSD
                    </span>
                    <span style={{ padding: '2px 6px', background: '#6366f120', color: '#6366f1', borderRadius: '4px' }}>
                      {usersWithSuperStake} SuperStake
                    </span>
                    <span style={{ padding: '2px 6px', background: '#f59e0b20', color: '#f59e0b', borderRadius: '4px' }}>
                      {usersWithLiquidity} LP
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
                }}>
                  {pools.length}
                </div>
                <div style={{ flex: 1 }}>
                  <p className="text-xs text-secondary">RWA Pools</p>
                  <p className="text-sm mt-1">{formatMUSD(totalVolume.toString())} mUSD volume</p>
                </div>
              </div>

              <div style={{ 
                marginTop: '8px',
                padding: '12px',
                background: 'linear-gradient(135deg, #1f293720, #1f293710)',
                borderRadius: '8px',
                border: '1px solid #374151'
              }}>
                <p className="text-xs text-secondary mb-2">Protocol Health</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Utilization: <strong>{totalChartValue > 0 ? ((debtChartValue / collateralChartValue) * 100).toFixed(1) : 0}%</strong></span>
                  <span>Active: <strong>{activeUsers}/{users.length}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
