import { http, createConfig } from 'wagmi';
import { baseSepolia, sepolia } from 'wagmi/chains';
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

export const config = createConfig({
  chains: [baseSepolia, sepolia],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: 'zk-SLA' }),
    walletConnect({ projectId }),
  ],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'),
  },
});

// Contract addresses (will be populated after deployment)
export const CONTRACTS = {
  EPOCH_MANAGER: (process.env.NEXT_PUBLIC_EPOCH_MANAGER_ADDR || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  ZK_SLA_1155: (process.env.NEXT_PUBLIC_ZKSLA_ADDR || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  MOCK_VERIFIER: (process.env.NEXT_PUBLIC_MOCK_VERIFIER_ADDR || '0x0000000000000000000000000000000000000000') as `0x${string}`,
};

export const VERIFIER_API = process.env.NEXT_PUBLIC_VERIFIER_URL || 'ws://localhost:3001';