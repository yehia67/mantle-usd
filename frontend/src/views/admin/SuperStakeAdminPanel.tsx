'use client';

import { gql, useQuery } from '@apollo/client';
import { formatMUSD, formatToken, formatAddress } from '@/utils/format';

const GET_ALL_SUPERSTAKE_POSITIONS = gql`
  query GetAllSuperStakePositions {
    superStakePositions(first: 100, where: { active: true }) {
      id
      user {
        id
        address
      }
      collateralLocked
      totalDebtMinted
      loops
      active
    }
  }
`;

export function SuperStakeAdminPanel() {
  const { data, loading } = useQuery(GET_ALL_SUPERSTAKE_POSITIONS);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Super Stake Positions</h3>
      </div>

      {loading ? (
        <div className="loading">Loading positions...</div>
      ) : (
        <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Collateral Locked</th>
                <th>Total Debt</th>
                <th>Loops</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.superStakePositions?.map((position: { id: string; user: { address: string }; collateralLocked: string; totalDebtMinted: string; loops: number }) => (
                <tr key={position.id}>
                  <td>{formatAddress(position.user.address)}</td>
                  <td>{formatToken(position.collateralLocked)} mETH</td>
                  <td>{formatMUSD(position.totalDebtMinted)} mUSD</td>
                  <td>{position.loops}</td>
                  <td>
                    <span className="badge badge-success">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
