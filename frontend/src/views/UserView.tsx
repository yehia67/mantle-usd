'use client';

import { UserDashboard } from './user/UserDashboard';
import { MUSDPositionPanel } from './user/MUSDPositionPanel';
import { SuperStakeUserPanel } from './user/SuperStakeUserPanel';
import { PoolsUserPanel } from './user/PoolsUserPanel';

export function UserView() {
  return (
    <div className="container">
      <UserDashboard />
      <div className="grid grid-2 mt-4">
        <MUSDPositionPanel />
        <SuperStakeUserPanel />
      </div>
      <div className="mt-4">
        <PoolsUserPanel />
      </div>
    </div>
  );
}
