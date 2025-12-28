import { useMemo } from 'react';
import { Contract, BrowserProvider } from 'ethers';
import { useAppKitProvider, useAppKitAccount } from '@reown/appkit/react';

export function useContract(address: string, abi: any) {
  const { walletProvider } = useAppKitProvider('eip155');
  const { isConnected } = useAppKitAccount();

  return useMemo(() => {
    if (!isConnected || !walletProvider || !address) return null;

    const provider = new BrowserProvider(walletProvider);
    return {
      read: new Contract(address, abi, provider),
      write: async () => {
        const signer = await provider.getSigner();
        return new Contract(address, abi, signer);
      }
    };
  }, [address, abi, walletProvider, isConnected]);
}
