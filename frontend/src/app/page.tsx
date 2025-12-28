'use client';

import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { NetworkGuard } from '@/components/NetworkGuard';
import { Header } from '@/components/Header';
import { UserView } from '@/views/UserView';
import { AdminView } from '@/views/AdminView';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const { isConnected } = useAppKitAccount();

  return (
    <NetworkGuard>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      {isConnected ? (
        activeTab === 'user' ? <UserView /> : <AdminView />
      ) : (
        <div className="container">
          <div className="card" style={{ textAlign: 'center', marginTop: '4rem' }}>
            <h2>Welcome to mUSD Protocol</h2>
            <p className="text-secondary mt-2">Connect your wallet to get started</p>
          </div>
        </div>
      )}
    </NetworkGuard>
  );
}