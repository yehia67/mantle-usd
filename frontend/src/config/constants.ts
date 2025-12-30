export const MANTLE_SEPOLIA_CHAIN_ID = 5003;

export const SUBGRAPH_URL = 'https://subgraph-api.mantle.xyz/api/public/cb8f3ffc-3a59-4f07-9dbc-d92b7b588833/subgraphs/mUSD/0.0.1/gn';

export const CONTRACT_ADDRESSES = {
  mUSD: '0x1ADE47C51C4850EcAc5F46Bb9C86835dc2EB5354',
  SuperStake: '0x915b4a846bD04180F044214a15446eBd680a64D7',
  RWAPoolFactory: '0x189956C062728196452Fe4330544e1d77D0b01BC',
  mETH: '0xDd37c9e2237506273F86dA1272Ca51470dF6e8ae',
  Swapper: '0x35cc0a5400D745EE96B082a9c70Cf7de44FAAFD3',
  ZKVerifier: '0xDBCf221465348424E6e30c95Ff8c3837427A191c',
} as const;

export const ASSETS = [
  { name: 'mETH', address: '0xdd37c9e2237506273f86da1272ca51470df6e8ae' },
  { name: 'Gold', address: '0x4ABD994Dd8e6581d909A6AcEf82e453d3E141d65' },
  { name: 'Real Estate Share', address: '0x7e086BeC259f8A7c02B4324e9e2dA149b4cD3784' },
  { name: 'Money Market Share', address: '0x7e086BeC259f8A7c02B4324e9e2dA149b4cD3784' },
];
