import { useState } from 'react';
import { parseEther } from 'ethers';
import { useAppKitAccount } from '@reown/appkit/react';
import { useContract } from './useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import MUSD_ABI from '@/abis/MUSD.json';
import ERC20_ABI from '@/abis/ERC20.json';

export function useMUSD() {
  const { address } = useAppKitAccount();
  const musdContract = useContract(CONTRACT_ADDRESSES.mUSD, MUSD_ABI);
  const mETHContract = useContract(CONTRACT_ADDRESSES.mETH, ERC20_ABI);
  const [loading, setLoading] = useState(false);

  const lockCollateral = async (amount: string) => {
    if (!musdContract || !mETHContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountWei = parseEther(amount);
      
      // Check and approve mETH if needed
      const mETH = await mETHContract.write();
      const allowance = await mETHContract.read.allowance(address, CONTRACT_ADDRESSES.mUSD);
      
      if (allowance < amountWei) {
        const approveTx = await mETH.approve(CONTRACT_ADDRESSES.mUSD, amountWei);
        await approveTx.wait();
      }
      
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
      const tx = await musd.unlockCollateral(parseEther(amount));
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
      const tx = await musd.mint(to, parseEther(amount));
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
      const tx = await musd.burn(from, parseEther(amount));
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

  return {
    lockCollateral,
    unlockCollateral,
    mint,
    burn,
    liquidate,
    loading,
  };
}
