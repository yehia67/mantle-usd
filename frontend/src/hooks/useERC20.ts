import { useState } from 'react';
import { parseToken } from '@/utils/decimals';
import { useContract } from './useContract';

const ERC20_ABI = [
  'function mint(address to, uint256 amount) external',
  'function burn(address from, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];

export function useERC20(tokenAddress: string) {
  const [loading, setLoading] = useState(false);
  const tokenContract = useContract(tokenAddress, ERC20_ABI);

  const mint = async (to: string, amount: string) => {
    if (!tokenContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const token = await tokenContract.write();
      const tx = await token.mint(to, parseToken(amount));
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const burn = async (from: string, amount: string) => {
    if (!tokenContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const token = await tokenContract.write();
      const tx = await token.burn(from, parseToken(amount));
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  return {
    mint,
    burn,
    loading,
  };
}
