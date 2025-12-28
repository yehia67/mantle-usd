import { useState } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { useContract } from './useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import { parseToken } from '@/utils/decimals';
import SUPERSTAKE_ABI from '@/abis/SuperStake.json';
import ERC20_ABI from '@/abis/ERC20.json';

export function useSuperStake() {
  const { address } = useAppKitAccount();
  const superStakeContract = useContract(CONTRACT_ADDRESSES.SuperStake, SUPERSTAKE_ABI);
  const mETHContract = useContract(CONTRACT_ADDRESSES.mETH, ERC20_ABI);
  const musdContract = useContract(CONTRACT_ADDRESSES.mUSD, ERC20_ABI);
  const [loading, setLoading] = useState(false);

  const deposit = async (ethAmount: string, loops: number, swapData: string = '0x') => {
    if (!superStakeContract || !mETHContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountWei = parseToken(ethAmount);
      
      // Check and approve mETH if needed
      const mETH = await mETHContract.write();
      const allowance = await mETHContract.read.allowance(address, CONTRACT_ADDRESSES.SuperStake);
      
      if (allowance < amountWei) {
        const approveTx = await mETH.approve(CONTRACT_ADDRESSES.SuperStake, amountWei);
        await approveTx.wait();
      }
      
      // Deposit
      const superStake = await superStakeContract.write();
      const tx = await superStake.deposit(amountWei, loops, swapData);
      await tx.wait();
      
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async (ethAmount: string, swapData: string = '0x') => {
    if (!superStakeContract || !musdContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountWei = parseToken(ethAmount);
      
      // Calculate debt to burn using SuperStake's preview function
      const debtToBurn = await superStakeContract.read.previewDebtForCollateral(amountWei);
      
      // Check and approve mUSD if needed
      const musd = await musdContract.write();
      const allowance = await musdContract.read.allowance(address, CONTRACT_ADDRESSES.SuperStake);
      
      if (allowance < debtToBurn) {
        const approveTx = await musd.approve(CONTRACT_ADDRESSES.SuperStake, debtToBurn);
        await approveTx.wait();
      }
      
      // Withdraw
      const superStake = await superStakeContract.write();
      const tx = await superStake.withdraw(amountWei, swapData);
      await tx.wait();
      return tx.hash;
    } finally {
      setLoading(false);
    }
  };

  return {
    deposit,
    withdraw,
    loading,
  };
}
