'use client'

import { ethersAdapter, projectId, mantleSepolia } from '@/config'
import { createAppKit } from '@reown/appkit/react'
import React, { type ReactNode } from 'react'

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Set up metadata
const metadata = {
  name: 'mUSD Protocol',
  description: 'Mantle USD Protocol Dashboard',
  url: 'https://musd-protocol.com',
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

// Create the modal
export const modal = createAppKit({
  adapters: [ethersAdapter],
  projectId,
  networks: [mantleSepolia],
  defaultNetwork: mantleSepolia,
  metadata,
  themeMode: 'light',
  features: {
    analytics: true,
    socials: false
  },
  themeVariables: {
    '--w3m-accent': '#000000',
  },
  enableWalletConnect: true,
  enableInjected: true,
  enableCoinbase: true,
  allWallets: 'SHOW',
  featuredWalletIds: []
})

function ContextProvider({ children }: { children: ReactNode}) {
  return (
    <>{children}</>
  )
}

export default ContextProvider
