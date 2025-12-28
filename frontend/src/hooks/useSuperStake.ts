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
  const [needsApprovalMETH, setNeedsApprovalMETH] = useState(false);
  const [needsApprovalMUSD, setNeedsApprovalMUSD] = useState(false);
  const [approvalAmountMETH, setApprovalAmountMETH] = useState<bigint>(BigInt(0));
  const [approvalAmountMUSD, setApprovalAmountMUSD] = useState<bigint>(BigInt(0));

  const checkDepositApproval = async (ethAmount: string) => {
    if (!mETHContract || !address) return false;
    
    try {
      const amountWei = parseToken(ethAmount);
      const allowance = await mETHContract.read.allowance(address, CONTRACT_ADDRESSES.SuperStake);
      const needs = allowance < amountWei;
      setNeedsApprovalMETH(needs);
      setApprovalAmountMETH(amountWei);
      return needs;
    } catch (error) {
      console.error('Error checking deposit approval:', error);
      return false;
    }
  };

  const checkWithdrawApproval = async (ethAmount: string) => {
    if (!superStakeContract || !musdContract || !address) return false;
    
    try {
      const amountWei = parseToken(ethAmount);
      const debtToBurn = await superStakeContract.read.previewDebtForCollateral(amountWei);
      const allowance = await musdContract.read.allowance(address, CONTRACT_ADDRESSES.SuperStake);
      const needs = allowance < debtToBurn;
      setNeedsApprovalMUSD(needs);
      setApprovalAmountMUSD(debtToBurn);
      return needs;
    } catch (error) {
      console.error('Error checking withdraw approval:', error);
      return false;
    }
  };

  const approveMETH = async () => {
    if (!mETHContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const mETH = await mETHContract.write();
      const approveTx = await mETH.approve(CONTRACT_ADDRESSES.SuperStake, approvalAmountMETH);
      await approveTx.wait();
      setNeedsApprovalMETH(false);
      return approveTx.hash;
    } finally {
      setLoading(false);
    }
  };

  const approveMUSD = async () => {
    if (!musdContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const musd = await musdContract.write();
      const approveTx = await musd.approve(CONTRACT_ADDRESSES.SuperStake, approvalAmountMUSD);
      await approveTx.wait();
      setNeedsApprovalMUSD(false);
      return approveTx.hash;
    } finally {
      setLoading(false);
    }
  };

  const deposit = async (ethAmount: string, loops: number, swapData: string = '0x') => {
    if (!superStakeContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountWei = parseToken(ethAmount);
      
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
    if (!superStakeContract || !address) throw new Error('Not connected');
    
    setLoading(true);
    try {
      const amountWei = parseToken(ethAmount);
      
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
    checkDepositApproval,
    checkWithdrawApproval,
    approveMETH,
    approveMUSD,
    needsApprovalMETH,
    needsApprovalMUSD,
    loading,
  };
}
