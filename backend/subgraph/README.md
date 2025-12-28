# mUSD Subgraph (Mantle Testnet)

This folder contains the Mantle mUSD protocol subgraph sources (schema, mappings, and manifest).  
Below are the up‑to‑date instructions for generating types, building, and deploying to Mantle’s hosted graph node.

## Prerequisites

1. Install dependencies:
   ```bash
   yarn install
   ```
2. Update `subgraph.yaml` with the latest contract addresses and `startBlock` before you deploy.
3. Ensure you have a valid Mantle subgraph deploy key with access to the project.

## Codegen & Build

```bash
npx graph codegen
npx graph build
```

## Deploy

```bash
npx graph deploy mUSD \
  --node https://subgraph-api.mantle.xyz/deploy \
  --ipfs https://subgraph-api.mantle.xyz/ipfs \
  --deploy-key <DEPLOY_KEY>
```

Replace `<DEPLOY_KEY>` with your Mantle deploy token. Successful deployments will be available at:

```
https://subgraph-api.mantle.xyz/api/public/<project-id>/subgraphs/mUSD/<version>/gn
```