import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { useContract } from './useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import { parseMUSD, parseToken } from '@/utils/decimals';
import MUSD_ABI from '@/abis/MUSD.json';
import ERC20_ABI from '@/abis/ERC20.json';

export function useMUSD() {
  const { address } = useAppKitAccount();
  const musdContract = useContract(CONTRACT_ADDRESSES.mUSD, MUSD_ABI);
  const mETHContract = useContract(CONTRACT_ADDRESSES.mETH, ERC20_ABI);
  const [loading, setLoading] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalAmount, setApprovalAmount] = useState<bigint>(BigInt(0));

  const checkApproval = async (amount: string) => {
    if (!mETHContract || !address) return false;
    
    try {
      const amountWei = parseToken(amount);
      const allowance = await mETHContract.read.allowance(address, CONTRACT_ADDRESSES.mUSD);
      const needs = allowance < amountWei;
      setNeedsApproval(needs);
      setApprovalAmount(amountWei);
      return needs;
    } catch (error) {
      console.error('Error checking approval:', error);
      return false;
    }
  };

  const approveMETH = async () => {
    if (!mETHContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const mETH = await mETHContract.write();
      const approveTx = await mETH.approve(CONTRACT_ADDRESSES.mUSD, approvalAmount);
      await approveTx.wait();
      setNeedsApproval(false);
      return approveTx.hash;
    } finally {
      setLoading(false);
    }
  };

  const lockCollateral = async (amount: string) => {
    if (!musdContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountWei = parseToken(amount);
      
      // Lock collateral
      const musd = await musdContract.write();
      const tx = await musd.lockCollateral(amountWei);
      await tx.wait();
      
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const unlockCollateral = async (amount: string) => {
    if (!musdContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const musd = await musdContract.write();
      const tx = await musd.unlockCollateral(parseToken(amount));
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const mint = async (to: string, amount: string) => {
    if (!musdContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const musd = await musdContract.write();
      const tx = await musd.mint(to, parseMUSD(amount));
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const burn = async (from: string, amount: string) => {
    if (!musdContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const musd = await musdContract.write();
      const tx = await musd.burn(from, parseMUSD(amount));
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const liquidate = async (account: string) => {
    if (!musdContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const musd = await musdContract.write();
      const tx = await musd.liquidate(account);
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const setCollateralPrice = async (priceUsd: string) => {
    if (!musdContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const musd = await musdContract.write();
      // Price in 1e18 precision
      const priceWei = parseToken(priceUsd);
      const tx = await musd.setCollateralPriceUsd(priceWei);
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const getHealthFactor = async (userAddress: string): Promise<number> => {
    if (!musdContract) return 0;
    
    try {
      const healthFactorBigInt = await musdContract.read.getHealthFactor(userAddress);
      // Contract returns health factor as percentage (e.g., 150 for 1.5x)
      return Number(healthFactorBigInt) / 100;
    } catch (error) {
      console.error('Error getting health factor:', error);
      return 0;
    }
  };

  const isLiquidatable = async (userAddress: string): Promise<boolean> => {
    if (!musdContract) return false;
    
    try {
      return await musdContract.read.isLiquidatable(userAddress);
    } catch (error) {
      console.error('Error checking liquidatable:', error);
      return false;
    }
  };

  return {
    lockCollateral,
    unlockCollateral,
    liquidate,
    setCollateralPrice,
    checkApproval,
    approveMETH,
    getHealthFactor,
    isLiquidatable,
    needsApproval,
    loading,
  };
}
