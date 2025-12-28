'use client';

import { gql, useQuery } from '@apollo/client';
import { formatBigInt, formatAddress } from '@/utils/format';

const GET_ALL_SUPERSTAKE_POSITIONS = gql`
  query GetAllSuperStakePositions {
    superStakePositions(first: 100, where: { active: true }) {
      id
      user
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
        <div className="table-container">
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
              {data?.superStakePositions?.map((position: any) => (
                <tr key={position.id}>
                  <td>{formatAddress(position.user)}</td>
                  <td>{formatBigInt(position.collateralLocked)} mETH</td>
                  <td>{formatBigInt(position.totalDebtMinted)} mUSD</td>
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
