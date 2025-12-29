import { useState } from 'react';
import { useContract } from './useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import FACTORY_ABI from '@/abis/RWAPoolFactory.json';

export function useRWAPoolFactory() {
  const factoryContract = useContract(CONTRACT_ADDRESSES.RWAPoolFactory, FACTORY_ABI);
  const [loading, setLoading] = useState(false);

  const createPool = async (
    mUSD: string,
    rwaToken: string,
    verifier: string,
    allowedImageId: string
  ) => {
    if (!factoryContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const factory = await factoryContract.write();
      const tx = await factory.createPool(mUSD, rwaToken, verifier, allowedImageId);
      const receipt = await tx.wait();
      
      // Extract pool address from event logs
      const poolCreatedEvent = receipt.logs.find((log: { topics: string[] }) => 
        log.topics[0] === '0x...' // PoolCreated event signature
      );
      
      return {
        txHash: tx.hash,
        poolAddress: poolCreatedEvent?.address || null
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    createPool,
    loading,
  };
}
