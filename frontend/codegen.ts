import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'https://subgraph-api.mantle.xyz/api/public/cb8f3ffc-3a59-4f07-9dbc-d92b7b588833/subgraphs/mUSD/0.0.1/gn',
  documents: ['src/**/*.tsx', 'src/**/*.ts'],
  ignoreNoDocuments: true,
  generates: {
    './src/gql/': {
      preset: 'client',
      plugins: [],
      config: {
        scalars: {
          BigInt: 'string',
          BigDecimal: 'string',
          Bytes: 'string',
        },
      },
    },
  },
};

export default config;
