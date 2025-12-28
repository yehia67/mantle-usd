'use client';

import { useAppKitAccount } from '@reown/appkit/react';

export function Header({ activeTab, onTabChange }: { activeTab: 'user' | 'admin'; onTabChange: (tab: 'user' | 'admin') => void }) {
  const { address, isConnected } = useAppKitAccount();

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div>
            <h1>mUSD Protocol</h1>
            {isConnected && (
              <p className="text-sm text-secondary">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            )}
          </div>
          <div>
            <w3m-button />
          </div>
        </div>
        {isConnected && (
          <div className="tabs">
            <div
              className={`tab ${activeTab === 'user' ? 'active' : ''}`}
              onClick={() => onTabChange('user')}
            >
              User
            </div>
            <div
              className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => onTabChange('admin')}
            >
              Admin
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
