# mUSD Protocol Frontend

A clean, elegant Next.js application for interacting with the mUSD protocol on Mantle Sepolia.

## Features

- **User Dashboard**: View balances, debt, collateral, and health factor
- **mUSD Position Management**: Lock/unlock collateral, mint/burn mUSD
- **Super Stake**: Leveraged staking with recursive loops (1-3x)
- **RWA Pools**: Swap mUSD ↔ RWA tokens with compliance verification
- **Admin Panel**: Protocol-wide monitoring, liquidation management, pool factory

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Wallet**: Reown AppKit
- **Data**: Apollo Client + GraphQL (Mantle Subgraph)
- **Network**: Mantle Sepolia (Chain ID: 5003)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Reown**
   - Go to [Reown Dashboard](https://dashboard.reown.com) and create a project
   - Copy your Project ID
   - Rename `.env.example` to `.env`
   - Set `NEXT_PUBLIC_PROJECT_ID=your_project_id`

3. **Update Contract Addresses**
   - Edit `src/config/constants.ts`
   - Add deployed contract addresses for mUSD, SuperStake, and RWAPoolFactory

4. **Generate GraphQL Types** (optional)
   ```bash
   npm run codegen
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Network Requirements

The application **only works on Mantle Sepolia** (Chain ID: 5003). Users on other networks will be prompted to switch.

## Architecture

```
src/
├── app/                    # Next.js App Router
├── components/             # Shared UI components
├── views/                  # User and Admin views
│   ├── user/              # User-specific panels
│   └── admin/             # Admin-specific panels
├── providers/             # Apollo and Wallet providers
├── config/                # Constants and configuration
├── lib/                   # Apollo client setup
└── utils/                 # Formatting utilities
```

## Data Source

All protocol data is fetched from the Mantle Subgraph:
```
https://subgraph-api.mantle.xyz/api/public/cb8f3ffc-3a59-4f07-9dbc-d92b7b588833/subgraphs/mUSD/0.0.1/gn
```

## Resources

- [Reown Documentation](https://docs.reown.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Apollo Client Documentation](https://www.apollographql.com/docs/react)
