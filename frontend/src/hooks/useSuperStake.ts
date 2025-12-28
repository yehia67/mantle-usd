import { useState } from 'react';
import { parseEther } from 'ethers';
import { useAppKitAccount } from '@reown/appkit/react';
import { useContract } from './useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import SUPERSTAKE_ABI from '@/abis/SuperStake.json';
import ERC20_ABI from '@/abis/ERC20.json';

export function useSuperStake() {
  const { address } = useAppKitAccount();
  const superStakeContract = useContract(CONTRACT_ADDRESSES.SuperStake, SUPERSTAKE_ABI);
  const mETHContract = useContract(CONTRACT_ADDRESSES.mETH, ERC20_ABI);
  const [loading, setLoading] = useState(false);

  const deposit = async (ethAmount: string, loops: number, swapData: string = '0x') => {
    if (!superStakeContract || !mETHContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountWei = parseEther(ethAmount);
      
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
    if (!superStakeContract) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const superStake = await superStakeContract.write();
      const tx = await superStake.withdraw(parseEther(ethAmount), swapData);
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
