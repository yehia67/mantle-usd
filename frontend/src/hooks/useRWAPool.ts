import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { useContract } from './useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import { parseMUSD, parseToken } from '@/utils/decimals';
import RWAPOOL_ABI from '@/abis/RWAPool.json';
import ERC20_ABI from '@/abis/ERC20.json';

export function useRWAPool(poolAddress: string, rwaTokenAddress?: string) {
  const { address } = useAppKitAccount();
  const poolContract = useContract(poolAddress, RWAPOOL_ABI);
  const musdContract = useContract(CONTRACT_ADDRESSES.mUSD, ERC20_ABI);
  const rwaTokenContract = useContract(rwaTokenAddress || CONTRACT_ADDRESSES.mUSD, ERC20_ABI);
  const [loading, setLoading] = useState(false);
  const [needsApprovalMUSD, setNeedsApprovalMUSD] = useState(false);
  const [needsApprovalRWA, setNeedsApprovalRWA] = useState(false);
  const [approvalAmountMUSD, setApprovalAmountMUSD] = useState<bigint>(BigInt(0));
  const [approvalAmountRWA, setApprovalAmountRWA] = useState<bigint>(BigInt(0));

  const checkSwapApproval = async (tokenIn: string, amountIn: string) => {
    if (!address) return false;
    
    try {
      const isMUSDIn = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.mUSD.toLowerCase();
      const amountWei = isMUSDIn ? parseMUSD(amountIn) : parseToken(amountIn);
      const approvalContract = isMUSDIn ? musdContract : rwaTokenContract;
      
      if (!approvalContract) return false;
      
      const allowance = await approvalContract.read.allowance(address, poolAddress);
      const needs = allowance < amountWei;
      
      if (isMUSDIn) {
        setNeedsApprovalMUSD(needs);
        setApprovalAmountMUSD(amountWei);
      } else {
        setNeedsApprovalRWA(needs);
        setApprovalAmountRWA(amountWei);
      }
      
      return needs;
    } catch (error) {
      console.error('Error checking swap approval:', error);
      return false;
    }
  };

  const approveSwapToken = async (tokenIn: string) => {
    if (!address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const isMUSDIn = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.mUSD.toLowerCase();
      const approvalContract = isMUSDIn ? musdContract : rwaTokenContract;
      const amount = isMUSDIn ? approvalAmountMUSD : approvalAmountRWA;
      
      if (!approvalContract) throw new Error('Token contract not initialized');
      
      const token = await approvalContract.write();
      const approveTx = await token.approve(poolAddress, amount);
      await approveTx.wait();
      
      if (isMUSDIn) {
        setNeedsApprovalMUSD(false);
      } else {
        setNeedsApprovalRWA(false);
      }
      
      return approveTx.hash;
    } finally {
      setLoading(false);
    }
  };

  const swap = async (
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut: string,
    seal: string,
    imageId: string,
    journalDigest: string
  ) => {
    if (!poolContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const isMUSDIn = tokenIn.toLowerCase() === CONTRACT_ADDRESSES.mUSD.toLowerCase();
      const isMUSDOut = tokenOut.toLowerCase() === CONTRACT_ADDRESSES.mUSD.toLowerCase();
      const amountWei = isMUSDIn ? parseMUSD(amountIn) : parseToken(amountIn);
      
      const pool = await poolContract.write();
      const tx = await pool.swap(
        tokenIn,
        tokenOut,
        amountWei,
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

  const checkLiquidityApproval = async (amountMUSD: string, amountRWA: string) => {
    if (!musdContract || !rwaTokenContract || !address) return { needsMUSD: false, needsRWA: false };
    
    try {
      const amountMUSDWei = parseMUSD(amountMUSD);
      const amountRWAWei = parseToken(amountRWA);
      
      const musdAllowance = await musdContract.read.allowance(address, poolAddress);
      const rwaAllowance = await rwaTokenContract.read.allowance(address, poolAddress);
      
      const needsMUSD = musdAllowance < amountMUSDWei;
      const needsRWA = rwaAllowance < amountRWAWei;
      
      setNeedsApprovalMUSD(needsMUSD);
      setNeedsApprovalRWA(needsRWA);
      setApprovalAmountMUSD(amountMUSDWei);
      setApprovalAmountRWA(amountRWAWei);
      
      return { needsMUSD, needsRWA };
    } catch (error) {
      console.error('Error checking liquidity approval:', error);
      return { needsMUSD: false, needsRWA: false };
    }
  };

  const approveMUSD = async () => {
    if (!musdContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const musd = await musdContract.write();
      const approveTx = await musd.approve(poolAddress, approvalAmountMUSD);
      await approveTx.wait();
      setNeedsApprovalMUSD(false);
      return approveTx.hash;
    } finally {
      setLoading(false);
    }
  };

  const approveRWA = async () => {
    if (!rwaTokenContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const rwaToken = await rwaTokenContract.write();
      const approveTx = await rwaToken.approve(poolAddress, approvalAmountRWA);
      await approveTx.wait();
      setNeedsApprovalRWA(false);
      return approveTx.hash;
    } finally {
      setLoading(false);
    }
  };

  const addLiquidity = async (amountMUSD: string, amountRWA: string, minLiquidity: string = '0') => {
    if (!poolContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountMUSDWei = parseMUSD(amountMUSD);
      const amountRWAWei = parseToken(amountRWA);
      
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
    checkSwapApproval,
    checkLiquidityApproval,
    approveSwapToken,
    approveMUSD,
    approveRWA,
    needsApprovalMUSD,
    needsApprovalRWA,
    loading,
  };
}
