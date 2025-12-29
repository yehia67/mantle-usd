'use client';

import { useState } from 'react';
import { NetworkGuard } from '@/components/NetworkGuard';
import { Header } from '@/components/Header';
import { UserView } from '@/views/UserView';
import { AdminView } from '@/views/AdminView';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  return (
    <NetworkGuard>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'user' ? <UserView /> : <AdminView />}
    </NetworkGuard>
  );
}