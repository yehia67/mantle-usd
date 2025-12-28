import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { defineChain } from '@reown/appkit/networks'

// Get projectId from https://dashboard.reown.com
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694"

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Define Mantle Sepolia network
export const mantleSepolia = defineChain({
  id: 5003,
  caipNetworkId: 'eip155:5003',
  chainNamespace: 'eip155',
  name: 'Mantle Sepolia',
  nativeCurrency: {
    name: 'MNT',
    symbol: 'MNT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.sepolia.mantle.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Sepolia Explorer',
      url: 'https://sepolia.mantlescan.xyz',
    },
  },
  contracts: {},
})

export const networks = [mantleSepolia]

export const ethersAdapter = new EthersAdapter()