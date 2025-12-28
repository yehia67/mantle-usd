import { useMemo } from 'react';
import { Contract, BrowserProvider, InterfaceAbi, Eip1193Provider } from 'ethers';
import { useAppKitProvider, useAppKitAccount } from '@reown/appkit/react';

export function useContract(address: string, abi: InterfaceAbi) {
  const { walletProvider } = useAppKitProvider('eip155');
  const { isConnected } = useAppKitAccount();

  return useMemo(() => {
    if (!isConnected || !walletProvider || !address) return null;

    const provider = new BrowserProvider(walletProvider as Eip1193Provider);
    return {
      read: new Contract(address, abi, provider),
      write: async () => {
        const signer = await provider.getSigner();
        return new Contract(address, abi, signer);
      }
    };
  }, [address, abi, walletProvider, isConnected]);
}
