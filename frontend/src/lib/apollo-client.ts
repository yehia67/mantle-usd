import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { SUBGRAPH_URL } from '@/config/constants';

const httpLink = new HttpLink({
  uri: SUBGRAPH_URL,
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
