import { useAppKitAccount } from '@reown/appkit/react';
import { useContract } from './useContract';
import { CONTRACT_ADDRESSES } from '@/config/constants';
import ERC20_ABI from '@/abis/ERC20.json';

export function useMETH() {
  const { address } = useAppKitAccount();
  const methContract = useContract(CONTRACT_ADDRESSES.mETH, ERC20_ABI);

  const mintMETH = async () => {
    if (!methContract || !address) throw new Error('Not connected');
    
    const contract = await methContract.write();
    const amount = BigInt(10) * BigInt(10 ** 18); // 10 mETH
    const tx = await contract.mint(address, amount);
    await tx.wait();
    return tx.hash;
  };

  return {
    mintMETH,
  };
}
