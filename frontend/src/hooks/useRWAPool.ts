import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { useContract } from './useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import { parseMUSD, parseToken } from '@/utils/decimals';
import RWAPOOL_ABI from '@/abis/RWAPool.json';
import ERC20_ABI from '@/abis/ERC20.json';

export function useRWAPool(poolAddress: string) {
  const { address } = useAppKitAccount();
  const poolContract = useContract(poolAddress, RWAPOOL_ABI);
  const musdContract = useContract(CONTRACT_ADDRESSES.mUSD, ERC20_ABI);
  const [loading, setLoading] = useState(false);

  const swap = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut: string,
    seal: string,
    imageId: string,
    journalDigest: string
  ) => {
    if (!poolContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      // Approve token if needed
      const tokenContract = useContract(tokenIn, ERC20_ABI);
      if (tokenContract && address) {
        const token = await tokenContract.write();
        // Use appropriate decimals based on token (mUSD = 6, RWA = 18)
        const isMUSD = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.mUSD.toLowerCase();
        const amountWei = isMUSD ? parseMUSD(amountIn) : parseToken(amountIn);
        const allowance = await tokenContract.read.allowance(address, poolAddress);
        
        if (allowance < amountWei) {
          const approveTx = await token.approve(poolAddress, amountWei);
          await approveTx.wait();
        }
      }
      
      const pool = await poolContract.write();
      const isMUSDIn = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.mUSD.toLowerCase();
      const isMUSDOut = tokenOut.toLowerCase() === CONTRACT_ADDRESSES.mUSD.toLowerCase();
      const tx = await pool.swap(
        tokenIn,
        tokenOut,
        isMUSDIn ? parseMUSD(amountIn) : parseToken(amountIn),
        isMUSDOut ? parseMUSD(minAmountOut) : parseToken(minAmountOut),
        seal,
        imageId,
        journalDigest
      );
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const addLiquidity = async (amountMUSD: string, amountRWA: string, minLiquidity: string = '0') => {
    if (!poolContract || !musdContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountMUSDWei = parseMUSD(amountMUSD);
      const amountRWAWei = parseToken(amountRWA);
      
      // Approve mUSD
      const musd = await musdContract.write();
      const allowance = await musdContract.read.allowance(address, poolAddress);
      
      if (allowance < amountMUSDWei) {
        const approveTx = await musd.approve(poolAddress, amountMUSDWei);
        await approveTx.wait();
      }
      
      // Add liquidity
      const pool = await poolContract.write();
      const tx = await pool.addLiquidity(amountMUSDWei, amountRWAWei, parseToken(minLiquidity));
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const removeLiquidity = async (liquidity: string, minAmountMUSD: string = '0', minAmountRWA: string = '0') => {
    if (!poolContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const pool = await poolContract.write();
      const tx = await pool.removeLiquidity(
        parseToken(liquidity),
        parseMUSD(minAmountMUSD),
        parseToken(minAmountRWA)
      );
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  return {
    swap,
    addLiquidity,
    removeLiquidity,
    loading,
  };
}
